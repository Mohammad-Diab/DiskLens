use crate::models::{DiskInfo, FileEntry, FileKind, ScanResult};
use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::SystemTime;
use sysinfo::Disks;
use tauri::Emitter;

#[cfg(windows)]
use std::os::windows::fs::MetadataExt;

// ─── Scan control state ───────────────────────────────────────────────────────

pub struct ScanControl {
    pub stop:   Arc<AtomicBool>,
    pub paused: Arc<AtomicBool>,
}

impl Default for ScanControl {
    fn default() -> Self {
        Self {
            stop:   Arc::new(AtomicBool::new(false)),
            paused: Arc::new(AtomicBool::new(false)),
        }
    }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

fn hash_path(path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..8])
}

fn system_time_to_iso(st: std::io::Result<SystemTime>) -> String {
    match st {
        Ok(t) => {
            let dt: DateTime<Utc> = t.into();
            dt.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
        }
        Err(_) => String::new(),
    }
}

fn cluster_round(size: u64) -> u64 {
    const CLUSTER: u64 = 4096;
    if size == 0 { 0 } else { ((size + CLUSTER - 1) / CLUSTER) * CLUSTER }
}

fn normalize_path(s: &str) -> String {
    let trimmed = s.trim_end_matches(['\\', '/']);
    if trimmed.len() == 2 && trimmed.chars().nth(1) == Some(':') {
        return format!("{}\\", trimmed);
    }
    trimmed.to_string()
}

#[cfg(windows)]
fn file_attributes_from_meta(meta: &std::fs::Metadata) -> (bool, bool, bool) {
    let attrs = meta.file_attributes();
    let is_hidden    = attrs & 0x2 != 0;
    let is_read_only = attrs & 0x1 != 0;
    let is_system    = attrs & 0x4 != 0;
    (is_hidden, is_read_only, is_system)
}

#[cfg(not(windows))]
fn file_attributes_from_meta(_meta: &std::fs::Metadata) -> (bool, bool, bool) {
    (false, false, false)
}

pub fn build_entry_pub(path: &std::path::Path) -> Option<FileEntry> {
    let meta = std::fs::symlink_metadata(path).ok()?;
    let is_dir = meta.is_dir();
    let size_bytes = if is_dir { 0 } else { meta.len() };
    let path_str = normalize_path(&path.to_string_lossy());
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path_str.clone());
    let parent = path
        .parent()
        .map(|p| normalize_path(&p.to_string_lossy()))
        .unwrap_or_default();
    let (is_hidden, is_read_only, is_system) = file_attributes_from_meta(&meta);

    Some(FileEntry {
        id: hash_path(&path_str),
        name,
        path: path_str,
        parent,
        kind: FileKind::from_path(path, is_dir),
        size_bytes,
        size_on_disk: cluster_round(size_bytes),
        pct_disk: 0.0,
        pct_parent: 0.0,
        modified: system_time_to_iso(meta.modified()),
        accessed: system_time_to_iso(meta.accessed()),
        is_hidden,
        is_read_only,
        is_system,
        child_files: 0,
        child_folders: 0,
        total_items: 0,
    })
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_drives() -> Vec<DiskInfo> {
    tauri::async_runtime::spawn_blocking(|| {
        let disks = Disks::new_with_refreshed_list();
        disks
            .iter()
            .map(|disk| {
                let total = disk.total_space();
                let free  = disk.available_space();
                let used  = total.saturating_sub(free);
                DiskInfo {
                    drive_letter: disk.mount_point().to_string_lossy().to_string(),
                    label:        disk.name().to_string_lossy().to_string(),
                    filesystem:   disk.file_system().to_string_lossy().to_string(),
                    total_bytes:  total,
                    used_bytes:   used,
                    free_bytes:   free,
                }
            })
            .collect()
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub async fn scan_dir(
    path: String,
    app: tauri::AppHandle,
    scan_control: tauri::State<'_, ScanControl>,
) -> Result<ScanResult, ()> {
    scan_control.stop.store(false, Ordering::SeqCst);
    scan_control.paused.store(false, Ordering::SeqCst);

    let stop   = Arc::clone(&scan_control.stop);
    let paused = Arc::clone(&scan_control.paused);

    Ok(tauri::async_runtime::spawn_blocking(move || {
        let emit = |count: u64| { let _ = app.emit("scan_progress", count); };

        // USN journal fast path: NTFS fixed drive root + admin access
        #[cfg(windows)]
        if should_use_usn(&path) {
            println!("[DiskLens] Using USN journal for: {}", path);
            if let Some(result) = scan_dir_usn(&path, &emit, &stop, &paused) {
                return result;
            }
            println!("[DiskLens] USN failed, falling back to parallel scan");
        }
        #[cfg(windows)]
        if !should_use_usn(&path) {
            println!("[DiskLens] Using parallel scan for: {}", path);
        }

        // Rayon parallel scan (fallback for non-NTFS, non-admin, or subdirectories)
        scan_parallel(&path, &emit, &stop, &paused)
    })
    .await
    .unwrap_or_else(|_| ScanResult { path: String::new(), entries: vec![], total: 0 }))
}

#[tauri::command]
pub async fn stop_scan(scan_control: tauri::State<'_, ScanControl>) -> Result<(), ()> {
    scan_control.stop.store(true, Ordering::SeqCst);
    scan_control.paused.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn pause_scan(scan_control: tauri::State<'_, ScanControl>) -> Result<(), ()> {
    scan_control.paused.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn resume_scan(scan_control: tauri::State<'_, ScanControl>) -> Result<(), ()> {
    scan_control.paused.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn get_dir_children(path: String) -> Vec<FileEntry> {
    tauri::async_runtime::spawn_blocking(move || {
        let norm = normalize_path(&path);
        let Ok(rd) = std::fs::read_dir(&norm) else { return vec![]; };
        rd.filter_map(|e| e.ok())
            .filter_map(|e| build_entry_pub(&e.path()))
            .collect()
    })
    .await
    .unwrap_or_default()
}

// ─── Windows detection helpers ────────────────────────────────────────────────

/// Returns true if the drive letter's filesystem is NTFS.
#[cfg(windows)]
fn is_ntfs(path: &str) -> bool {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    let drive_root = {
        let t = path.trim_end_matches(['\\', '/']);
        if t.len() >= 2 && t.chars().nth(1) == Some(':') {
            format!("{}\\", &t[..2])
        } else {
            return false;
        }
    };

    let wide: Vec<u16> = OsStr::new(&drive_root).encode_wide().chain(Some(0)).collect();
    let mut fs_name = [0u16; 16];
    let ok = unsafe {
        winapi::um::fileapi::GetVolumeInformationW(
            wide.as_ptr(),
            std::ptr::null_mut(), 0,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            fs_name.as_mut_ptr(),
            fs_name.len() as u32,
        )
    };
    if ok == 0 { return false; }
    let len = fs_name.iter().position(|&c| c == 0).unwrap_or(fs_name.len());
    String::from_utf16_lossy(&fs_name[..len]) == "NTFS"
}

/// Returns true if the drive is a fixed local disk (not network/virtual/removable).
#[cfg(windows)]
fn is_fixed_drive(path: &str) -> bool {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    let drive_root: String = path.chars().take(2).collect::<String>() + "\\";
    let wide: Vec<u16> = OsStr::new(&drive_root).encode_wide().chain(Some(0)).collect();
    // DRIVE_FIXED = 3
    unsafe { winapi::um::fileapi::GetDriveTypeW(wide.as_ptr()) == 3 }
}

/// Returns true if the raw volume can be opened (admin rights available).
#[cfg(windows)]
fn can_open_volume(path: &str) -> bool {
    let drive: String = path.chars().take(2).collect();
    std::fs::File::open(format!("\\\\.\\{}", drive)).is_ok()
}

/// USN fast path is only worthwhile when scanning a whole drive root (C:\).
/// For subdirectories the enumeration overhead isn't worth it.
#[cfg(windows)]
fn should_use_usn(path: &str) -> bool {
    let norm = normalize_path(path);
    // Must be exactly a drive root: "C:\"
    let is_drive_root = norm.len() == 3
        && norm.chars().nth(1) == Some(':')
        && norm.ends_with('\\');
    is_drive_root && is_fixed_drive(&norm) && is_ntfs(&norm) && can_open_volume(&norm)
}

// ─── Shared raw entry type ────────────────────────────────────────────────────

struct RawEntry {
    path:         String,
    parent:       String,
    name:         String,
    is_dir:       bool,
    raw_size:     u64,
    size_on_disk: u64,
    modified:     String,
    accessed:     String,
    is_hidden:    bool,
    is_read_only: bool,
    is_system:    bool,
}

// ─── Shared result builder ────────────────────────────────────────────────────

fn build_result_from_raw(root: String, raw: Vec<RawEntry>) -> ScanResult {
    if raw.is_empty() {
        return ScanResult { path: root, entries: vec![], total: 0 };
    }

    // Cumulative folder sizes (files propagate up to parents)
    let mut folder_size: HashMap<String, u64> = HashMap::new();
    folder_size.insert(root.clone(), 0);
    for e in &raw {
        if e.is_dir { folder_size.entry(e.path.clone()).or_insert(0); }
    }
    for e in &raw {
        if !e.is_dir {
            *folder_size.entry(e.parent.clone()).or_insert(0) += e.raw_size;
        }
    }

    // Propagate child sizes to parents (deepest first)
    let mut dir_paths: Vec<String> = folder_size.keys().cloned().collect();
    dir_paths.sort_unstable_by(|a, b| b.len().cmp(&a.len()));
    for dir_path in &dir_paths {
        let size = *folder_size.get(dir_path).unwrap_or(&0);
        if size == 0 { continue; }
        let parent_path = std::path::Path::new(dir_path)
            .parent()
            .map(|p| normalize_path(&p.to_string_lossy()))
            .unwrap_or_default();
        if !parent_path.is_empty() {
            if let Some(p) = folder_size.get_mut(&parent_path) {
                *p += size;
            }
        }
    }

    let total_size = *folder_size.get(&root).unwrap_or(&0);

    // Direct child counts
    let mut child_files_map:   HashMap<String, u64> = HashMap::new();
    let mut child_folders_map: HashMap<String, u64> = HashMap::new();
    for e in &raw {
        if e.is_dir { *child_folders_map.entry(e.parent.clone()).or_insert(0) += 1; }
        else        { *child_files_map.entry(e.parent.clone()).or_insert(0)   += 1; }
    }

    let entries: Vec<FileEntry> = raw
        .into_iter()
        .map(|e| {
            let size = if e.is_dir {
                *folder_size.get(&e.path).unwrap_or(&0)
            } else {
                e.raw_size
            };
            let parent_total = (*folder_size.get(&e.parent).unwrap_or(&1)).max(1);
            let pct_parent = (size as f64 / parent_total as f64) * 100.0;
            let pct_disk   = if total_size > 0 { (size as f64 / total_size as f64) * 100.0 } else { 0.0 };
            let cf  = *child_files_map.get(&e.path).unwrap_or(&0);
            let cfo = *child_folders_map.get(&e.path).unwrap_or(&0);

            FileEntry {
                id:   hash_path(&e.path),
                name: e.name,
                path: e.path.clone(),
                parent: e.parent,
                kind: FileKind::from_path(std::path::Path::new(&e.path), e.is_dir),
                size_bytes:   size,
                size_on_disk: if e.is_dir { cluster_round(size) } else { e.size_on_disk },
                pct_disk,
                pct_parent,
                modified:     e.modified,
                accessed:     e.accessed,
                is_hidden:    e.is_hidden,
                is_read_only: e.is_read_only,
                is_system:    e.is_system,
                child_files:   cf,
                child_folders: cfo,
                total_items:   cf + cfo,
            }
        })
        .collect();

    ScanResult { path: root, entries, total: total_size }
}

// ─── USN Journal scan (Windows, NTFS fixed drive root, admin) ────────────────
//
// Phase 1: FSCTL_ENUM_USN_DATA — enumerates every MFT record with filename,
//          parent FRN, and attributes (no sizes).
// Phase 2: BFS path resolution from NTFS root (FRN 5) → full path map.
// Phase 3: Filter to target root; parallel rayon metadata calls for file sizes.

#[cfg(windows)]
fn scan_dir_usn(
    root: &str,
    emit: &impl Fn(u64),
    stop: &Arc<AtomicBool>,
    paused: &Arc<AtomicBool>,
) -> Option<ScanResult> {
    use std::collections::VecDeque;
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use winapi::um::fileapi::{CreateFileW, OPEN_EXISTING};
    use winapi::um::handleapi::{CloseHandle, INVALID_HANDLE_VALUE};
    use winapi::um::ioapiset::DeviceIoControl;
    use winapi::um::winnt::{FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, GENERIC_READ};
    use winapi::shared::minwindef::DWORD;

    // FSCTL_ENUM_USN_DATA  = CTL_CODE(9, 44, 3, 0) = 0x000900B3
    const FSCTL_ENUM_USN_DATA: DWORD = 0x0009_00B3;
    const ERROR_HANDLE_EOF:    DWORD = 38;

    // Input: MFT_ENUM_DATA_V0
    #[repr(C)]
    struct MftEnumData { start_frn: u64, low_usn: i64, high_usn: i64 }

    let root_norm    = normalize_path(root);
    let drive_letter: String = root_norm.chars().take(2).collect(); // "C:"
    let drive_root   = format!("{}\\", drive_letter);               // "C:\"
    let volume_path  = format!("\\\\.\\{}", drive_letter);

    let wide: Vec<u16> = OsStr::new(&volume_path).encode_wide().chain(Some(0)).collect();
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            GENERIC_READ,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            std::ptr::null_mut(),
            OPEN_EXISTING,
            0,
            std::ptr::null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        println!("[DiskLens] USN: cannot open volume (not admin?)");
        return None;
    }

    // ── Phase 1: enumerate all USN records ────────────────────────────────────
    struct UsnEntry { parent: u64, name: String, is_dir: bool,
                      is_hidden: bool, is_read_only: bool, is_system: bool }

    let mut map: HashMap<u64, UsnEntry> = HashMap::with_capacity(500_000);
    let mut input = MftEnumData { start_frn: 0, low_usn: 0, high_usn: i64::MAX };
    const BUF: usize = 1 << 16; // 64 KB
    let mut buf = vec![0u8; BUF];
    let mut count: u64 = 0;

    loop {
        while paused.load(Ordering::Relaxed) {
            if stop.load(Ordering::Relaxed) { unsafe { CloseHandle(handle); } return None; }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        if stop.load(Ordering::Relaxed) { unsafe { CloseHandle(handle); } return None; }

        let mut bytes_ret: DWORD = 0;
        let ok = unsafe {
            DeviceIoControl(
                handle,
                FSCTL_ENUM_USN_DATA,
                &mut input as *mut _ as *mut _,
                std::mem::size_of::<MftEnumData>() as DWORD,
                buf.as_mut_ptr() as *mut _,
                BUF as DWORD,
                &mut bytes_ret,
                std::ptr::null_mut(),
            )
        };

        if ok == 0 {
            let err = unsafe { winapi::um::errhandlingapi::GetLastError() };
            if err == ERROR_HANDLE_EOF { break; }
            println!("[DiskLens] USN: DeviceIoControl error {}", err);
            unsafe { CloseHandle(handle); }
            return None;
        }
        if bytes_ret <= 8 { break; }

        // First 8 bytes = next StartFileReferenceNumber
        let next_frn = unsafe { std::ptr::read_unaligned(buf.as_ptr() as *const u64) };
        input.start_frn = next_frn;

        // Parse USN_RECORD_V2 records that follow
        // Layout offsets (all little-endian):
        //  +0  RecordLength      u32
        //  +8  FileReferenceNumber    u64
        //  +16 ParentFileReferenceNumber u64
        //  +52 FileAttributes    u32
        //  +56 FileNameLength    u16  (bytes)
        //  +58 FileNameOffset    u16  (from record start)
        let mut off = 8usize;
        while off + 60 <= bytes_ret as usize {
            let rec_len = unsafe {
                std::ptr::read_unaligned(buf.as_ptr().add(off) as *const u32)
            } as usize;
            if rec_len == 0 { break; }

            let frn        = unsafe { std::ptr::read_unaligned(buf.as_ptr().add(off +  8) as *const u64) };
            let parent_frn = unsafe { std::ptr::read_unaligned(buf.as_ptr().add(off + 16) as *const u64) };
            let attrs      = unsafe { std::ptr::read_unaligned(buf.as_ptr().add(off + 52) as *const u32) };
            let name_bytes = unsafe { std::ptr::read_unaligned(buf.as_ptr().add(off + 56) as *const u16) } as usize;
            let name_off   = unsafe { std::ptr::read_unaligned(buf.as_ptr().add(off + 58) as *const u16) } as usize;

            // Upper 16 bits of FRN are the sequence number; lower 48 are the record number
            let frn        = frn        & 0x0000_FFFF_FFFF_FFFF;
            let parent_frn = parent_frn & 0x0000_FFFF_FFFF_FFFF;

            let name_end = off + name_off + name_bytes;
            if name_bytes > 0 && name_end <= bytes_ret as usize {
                let name = {
                    let ptr = unsafe { buf.as_ptr().add(off + name_off) } as *const u16;
                    let sl  = unsafe { std::slice::from_raw_parts(ptr, name_bytes / 2) };
                    String::from_utf16_lossy(sl)
                };
                if !name.is_empty() && !name.starts_with('$') {
                    let is_dir       = attrs & 0x0010 != 0; // DIRECTORY
                    let is_reparse   = attrs & 0x0400 != 0; // REPARSE_POINT
                    let is_hidden    = attrs & 0x0002 != 0;
                    let is_read_only = attrs & 0x0001 != 0;
                    let is_system    = attrs & 0x0004 != 0;
                    if !is_reparse {
                        map.insert(frn, UsnEntry { parent: parent_frn, name, is_dir,
                                                   is_hidden, is_read_only, is_system });
                        count += 1;
                        if count % 10_000 == 0 { emit(count); }
                    }
                }
            }
            off += rec_len;
        }
    }
    unsafe { CloseHandle(handle); }
    emit(count);
    println!("[DiskLens] USN Phase 1: {} entries", count);

    if stop.load(Ordering::Relaxed) { return None; }

    // ── Phase 2: BFS path resolution from NTFS root (FRN 5) ──────────────────
    const NTFS_ROOT: u64 = 5;

    let mut children_of: HashMap<u64, Vec<u64>> = HashMap::with_capacity(map.len());
    for (&id, e) in &map {
        children_of.entry(e.parent).or_default().push(id);
    }

    let mut resolved: HashMap<u64, String> = HashMap::with_capacity(map.len());
    resolved.insert(NTFS_ROOT, drive_root.clone());

    let mut queue: VecDeque<u64> = VecDeque::new();
    queue.push_back(NTFS_ROOT);

    while let Some(pid) = queue.pop_front() {
        let parent_path = match resolved.get(&pid) { Some(p) => p.clone(), None => continue };
        let Some(kids)  = children_of.get(&pid) else { continue };
        for &kid in kids {
            if resolved.contains_key(&kid) { continue; }
            if let Some(e) = map.get(&kid) {
                let path = if parent_path.ends_with('\\') {
                    format!("{}{}", parent_path, e.name)
                } else {
                    format!("{}\\{}", parent_path, e.name)
                };
                resolved.insert(kid, path);
                queue.push_back(kid);
            }
        }
    }
    println!("[DiskLens] USN Phase 2: {} paths resolved", resolved.len());

    // Free children_of — BFS is done, it's no longer needed (~100 MB freed)
    drop(children_of);

    if stop.load(Ordering::Relaxed) { return None; }

    // ── Phase 3: filter to root, get file sizes in parallel ──────────────────
    // Move all needed data from `map` + `resolved` into a single flat Vec,
    // then drop both large HashMaps before the parallel metadata phase.
    let root_lower  = root_norm.to_lowercase();
    let root_prefix = if root_lower.ends_with('\\') { root_lower.clone() }
                      else { format!("{}\\", root_lower) };

    struct Cand { path: String, name: String, is_dir: bool,
                  is_hidden: bool, is_read_only: bool, is_system: bool }

    let candidates: Vec<Cand> = resolved
        .into_iter() // consumes resolved (~200 MB freed after)
        .filter(|(id, path)| {
            if *id == NTFS_ROOT { return false; }
            path.to_lowercase().starts_with(&root_prefix)
        })
        .filter_map(|(id, path)| {
            // Remove from map so we drain it as we go (~400 MB freed after loop)
            let e = map.remove(&id)?;
            Some(Cand { path, name: e.name, is_dir: e.is_dir,
                        is_hidden: e.is_hidden, is_read_only: e.is_read_only,
                        is_system: e.is_system })
        })
        .collect();

    drop(map); // fully drained — free remaining empty HashMap allocation

    println!("[DiskLens] USN Phase 3: {} entries in scope, fetching sizes...", candidates.len());

    use rayon::prelude::*;
    let raw: Vec<RawEntry> = candidates.into_par_iter().filter_map(|cand| {
        if stop.load(Ordering::Relaxed) { return None; }
        let parent_path = std::path::Path::new(&cand.path)
            .parent()
            .map(|p| normalize_path(&p.to_string_lossy()))
            .unwrap_or_else(|| root_norm.clone());

        if cand.is_dir {
            Some(RawEntry {
                path:         normalize_path(&cand.path),
                parent:       parent_path,
                name:         cand.name,
                is_dir:       true,
                raw_size:     0,
                size_on_disk: 0,
                modified:     String::new(),
                accessed:     String::new(),
                is_hidden:    cand.is_hidden,
                is_read_only: cand.is_read_only,
                is_system:    cand.is_system,
            })
        } else {
            let meta = std::fs::symlink_metadata(&cand.path).ok()?;
            let sz   = meta.len();
            Some(RawEntry {
                path:         normalize_path(&cand.path),
                parent:       parent_path,
                name:         cand.name,
                is_dir:       false,
                raw_size:     sz,
                size_on_disk: cluster_round(sz),
                modified:     system_time_to_iso(meta.modified()),
                accessed:     system_time_to_iso(meta.accessed()),
                is_hidden:    cand.is_hidden,
                is_read_only: cand.is_read_only,
                is_system:    cand.is_system,
            })
        }
    }).collect();

    println!("[DiskLens] USN complete: {} raw entries", raw.len());

    // Build full result (size aggregation uses all entries), then trim the IPC
    // payload to direct children only — the frontend lazy-loads deeper paths
    // via get_dir_children. Without this, a 2M-entry drive scan would serialize
    // ~800 MB of JSON, crashing the process.
    let mut result = build_result_from_raw(root_norm, raw);
    let root_lower = result.path.to_lowercase();
    result.entries.retain(|e| e.parent.to_lowercase() == root_lower);
    println!("[DiskLens] USN returning {} root-level entries", result.entries.len());
    Some(result)
}

// ─── Rayon parallel scan (all platforms, all drive types) ────────────────────
//
// Recursively reads directories in parallel using rayon work-stealing.
// Each directory level fans out to rayon threads; no global lock during scan,
// only a brief lock per directory batch to extend the shared Vec.

fn par_scan_inner(
    dir:   std::path::PathBuf,
    raw:   &Mutex<Vec<RawEntry>>,
    count: &AtomicU64,
    stop:  &Arc<AtomicBool>,
    paused: &Arc<AtomicBool>,
) {
    if stop.load(Ordering::Relaxed) { return; }

    while paused.load(Ordering::Relaxed) {
        if stop.load(Ordering::Relaxed) { return; }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    let Ok(read_dir) = std::fs::read_dir(&dir) else { return };
    let dir_str = normalize_path(&dir.to_string_lossy());

    let mut batch:   Vec<RawEntry>              = Vec::new();
    let mut subdirs: Vec<std::path::PathBuf>    = Vec::new();

    for entry in read_dir.filter_map(|e| e.ok()) {
        if stop.load(Ordering::Relaxed) { return; }

        let path = entry.path();
        let meta = match std::fs::symlink_metadata(&path) { Ok(m) => m, Err(_) => continue };
        if meta.file_type().is_symlink() { continue; }

        #[cfg(windows)]
        if meta.file_attributes() & 0x400 != 0 { continue; } // reparse point

        let is_dir       = meta.is_dir();
        let raw_size     = if is_dir { 0 } else { meta.len() };
        let (is_hidden, is_read_only, is_system) = file_attributes_from_meta(&meta);
        let path_str = normalize_path(&path.to_string_lossy());
        let name     = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();

        batch.push(RawEntry {
            path: path_str,
            parent: dir_str.clone(),
            name,
            is_dir,
            raw_size,
            size_on_disk: cluster_round(raw_size),
            modified: system_time_to_iso(meta.modified()),
            accessed: system_time_to_iso(meta.accessed()),
            is_hidden, is_read_only, is_system,
        });

        let n = count.fetch_add(1, Ordering::Relaxed) + 1;
        if n % 5_000 == 0 {
            // flush batch to shared vec periodically to avoid large allocations
            raw.lock().unwrap().extend(batch.drain(..));
        }

        if is_dir { subdirs.push(path); }
    }

    // Flush remaining batch
    if !batch.is_empty() {
        raw.lock().unwrap().extend(batch);
    }

    // Recurse into subdirectories in parallel
    use rayon::prelude::*;
    subdirs.into_par_iter().for_each(|subdir| {
        par_scan_inner(subdir, raw, count, stop, paused);
    });
}

fn scan_parallel(
    root:   &str,
    emit:   &impl Fn(u64),
    stop:   &Arc<AtomicBool>,
    paused: &Arc<AtomicBool>,
) -> ScanResult {
    let root_norm = normalize_path(root);
    if !std::path::Path::new(&root_norm).exists() {
        return ScanResult { path: root_norm, entries: vec![], total: 0 };
    }

    let raw   = Mutex::new(Vec::<RawEntry>::with_capacity(50_000));
    let count = AtomicU64::new(0);

    par_scan_inner(
        std::path::PathBuf::from(&root_norm),
        &raw,
        &count,
        stop,
        paused,
    );

    let final_count = count.load(Ordering::Relaxed);
    emit(final_count);

    let mut result = build_result_from_raw(root_norm, raw.into_inner().unwrap());

    // Cap IPC payload: if the scan is very large, trim to direct children only.
    // The frontend lazy-loads deeper paths via get_dir_children.
    const MAX_IPC_ENTRIES: usize = 100_000;
    if result.entries.len() > MAX_IPC_ENTRIES {
        let root_lower = result.path.to_lowercase();
        result.entries.retain(|e| e.parent.to_lowercase() == root_lower);
    }

    result
}
