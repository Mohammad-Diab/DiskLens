use crate::models::{DiskInfo, FileEntry, FileKind, ScanResult};
use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};
use std::time::SystemTime;
use sysinfo::Disks;
use tauri::Emitter;
use walkdir::WalkDir;

#[cfg(windows)]
use std::os::windows::fs::MetadataExt;

// ─── shared helpers ──────────────────────────────────────────────────────────

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
    if size == 0 {
        0
    } else {
        ((size + CLUSTER - 1) / CLUSTER) * CLUSTER
    }
}

#[cfg(windows)]
fn file_attributes_from_meta(meta: &std::fs::Metadata) -> (bool, bool, bool) {
    let attrs = meta.file_attributes();
    let is_hidden = attrs & winapi::um::winnt::FILE_ATTRIBUTE_HIDDEN != 0;
    let is_read_only = attrs & winapi::um::winnt::FILE_ATTRIBUTE_READONLY != 0;
    let is_system = attrs & winapi::um::winnt::FILE_ATTRIBUTE_SYSTEM != 0;
    (is_hidden, is_read_only, is_system)
}

#[cfg(not(windows))]
fn file_attributes_from_meta(_meta: &std::fs::Metadata) -> (bool, bool, bool) {
    (false, false, false)
}

pub fn build_entry_pub(path: &std::path::Path) -> Option<FileEntry> {
    build_entry(path)
}

fn build_entry(path: &std::path::Path) -> Option<FileEntry> {
    let meta = std::fs::metadata(path).ok()?;
    let is_dir = meta.is_dir();
    let size_bytes = if is_dir { 0 } else { meta.len() };
    let path_str = path.to_string_lossy().to_string();
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path_str.clone());

    let (is_hidden, is_read_only, is_system) = file_attributes_from_meta(&meta);

    Some(FileEntry {
        id: hash_path(&path_str),
        name,
        path: path_str,
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

// ─── MFT fast path (Windows NTFS + admin only) ───────────────────────────────

#[cfg(windows)]
fn is_admin() -> bool {
    use std::mem;
    use winapi::um::handleapi::CloseHandle;
    use winapi::um::processthreadsapi::{GetCurrentProcess, OpenProcessToken};
    use winapi::um::securitybaseapi::GetTokenInformation;
    use winapi::um::winnt::{TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};

    unsafe {
        let mut token = std::ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
            return false;
        }
        let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
        let mut size = mem::size_of::<TOKEN_ELEVATION>() as u32;
        let ok = GetTokenInformation(
            token,
            TokenElevation,
            &mut elevation as *mut _ as *mut _,
            size,
            &mut size,
        );
        CloseHandle(token);
        ok != 0 && elevation.TokenIsElevated != 0
    }
}

#[cfg(windows)]
fn is_ntfs(path: &str) -> bool {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use winapi::um::fileapi::GetVolumeInformationW;

    let root = if path.len() >= 2 && path.chars().nth(1) == Some(':') {
        format!("{}\\", &path[..2])
    } else {
        return false;
    };

    let root_wide: Vec<u16> = OsStr::new(&root)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut fs_name = vec![0u16; 32];

    let ok = unsafe {
        GetVolumeInformationW(
            root_wide.as_ptr(),
            std::ptr::null_mut(),
            0,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            fs_name.as_mut_ptr(),
            fs_name.len() as u32,
        )
    };

    if ok == 0 {
        return false;
    }

    let end = fs_name.iter().position(|&c| c == 0).unwrap_or(fs_name.len());
    String::from_utf16_lossy(&fs_name[..end]) == "NTFS"
}

/// Convert Windows FILETIME (100-ns intervals since 1601-01-01) to ISO 8601.
#[cfg(windows)]
fn nt_time_to_iso(nt: &ntfs::NtfsTime) -> String {
    const EPOCH_DIFF_SECS: u64 = 11_644_473_600;
    let ts = nt.nt_timestamp();
    let secs = ts / 10_000_000;
    if secs < EPOCH_DIFF_SECS {
        return String::new();
    }
    let unix_secs = secs - EPOCH_DIFF_SECS;
    let nanos = ((ts % 10_000_000) * 100) as u32;
    chrono::DateTime::from_timestamp(unix_secs as i64, nanos)
        .map(|dt| dt.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string())
        .unwrap_or_default()
}

#[cfg(windows)]
fn scan_dir_mft(path: &str, emit: &impl Fn(u64)) -> Option<ScanResult> {
    use ntfs::structured_values::NtfsFileAttributeFlags;
    use ntfs::Ntfs;

    let drive = if path.len() >= 2 && path.chars().nth(1) == Some(':') {
        &path[..2]
    } else {
        return None;
    };

    let device_path = format!("\\\\.\\{}", drive);
    let mut f = std::fs::OpenOptions::new()
        .read(true)
        .open(&device_path)
        .ok()?;

    let ntfs = Ntfs::new(&mut f).ok()?;

    // Path parts after the drive letter (e.g., ["Users", "foo"])
    let path_parts: Vec<String> = path
        .replace('\\', "/")
        .split('/')
        .filter(|s| !s.is_empty())
        .skip(1) // skip "C:" component
        .map(|s| s.to_owned())
        .collect();

    // Navigate from root to the target directory
    let mut current = ntfs.root_directory(&mut f).ok()?;

    for part in &path_parts {
        let found: Option<ntfs::NtfsFile<'_>> = {
            match current.directory_index(&mut f) {
                Err(_) => None,
                Ok(index) => {
                    let mut iter = index.entries();
                    let mut result: Option<ntfs::NtfsFile<'_>> = None;
                    while let Some(entry) = iter.next(&mut f) {
                        if let Ok(e) = entry {
                            if let Some(Ok(key)) = e.key() {
                                let name = key.name().to_string_lossy().to_owned();
                                if name.as_str().eq_ignore_ascii_case(part.as_str()) {
                                    if let Ok(file) = e.to_file(&ntfs, &mut f) {
                                        result = Some(file);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    result
                    // index and iter dropped here, releasing borrow of current
                }
            }
        };
        current = found?;
    }

    // List children of the target directory using NtfsFileName key data
    let index = current.directory_index(&mut f).ok()?;
    let mut iter = index.entries();
    let mut entries: Vec<FileEntry> = Vec::new();
    let mut count: u64 = 0;

    while let Some(entry) = iter.next(&mut f) {
        let e = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let key = match e.key() {
            Some(Ok(k)) => k,
            _ => continue,
        };

        let name_str = key.name().to_string_lossy().to_owned();

        // Skip dot entries
        if name_str == "." || name_str == ".." {
            continue;
        }

        let fa = key.file_attributes();
        let is_hidden = fa.contains(NtfsFileAttributeFlags::HIDDEN);
        let is_read_only = fa.contains(NtfsFileAttributeFlags::READ_ONLY);
        let is_system = fa.contains(NtfsFileAttributeFlags::SYSTEM);
        let is_dir = key.is_directory();

        let size_bytes = if is_dir { 0 } else { key.data_size() };
        let size_on_disk = if is_dir { 0 } else { key.allocated_size() };

        let modified = nt_time_to_iso(&key.modification_time());
        let accessed = nt_time_to_iso(&key.access_time());

        let entry_path = format!("{}\\{}", path.trim_end_matches('\\'), name_str);
        let kind = FileKind::from_path(std::path::Path::new(&entry_path), is_dir);

        entries.push(FileEntry {
            id: hash_path(&entry_path),
            name: name_str,
            path: entry_path,
            kind,
            size_bytes,
            size_on_disk,
            pct_disk: 0.0,
            pct_parent: 0.0,
            modified,
            accessed,
            is_hidden,
            is_read_only,
            is_system,
            child_files: 0,
            child_folders: 0,
            total_items: 0,
        });
        count += 1;
        if count % 25 == 0 {
            emit(count);
        }
    }
    emit(count);

    let total: u64 = entries.iter().map(|e| e.size_bytes).sum();
    Some(ScanResult {
        path: path.to_string(),
        entries,
        total,
    })
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_drives() -> Vec<DiskInfo> {
    let disks = Disks::new_with_refreshed_list();
    disks
        .iter()
        .map(|disk| {
            let total = disk.total_space();
            let free = disk.available_space();
            let used = total.saturating_sub(free);
            DiskInfo {
                drive_letter: disk.mount_point().to_string_lossy().to_string(),
                label: disk.name().to_string_lossy().to_string(),
                filesystem: disk.file_system().to_string_lossy().to_string(),
                total_bytes: total,
                used_bytes: used,
                free_bytes: free,
            }
        })
        .collect()
}

#[tauri::command]
pub fn scan_dir(path: String, _depth: Option<u32>, app: tauri::AppHandle) -> ScanResult {
    let emit = |count: u64| {
        let _ = app.emit("scan_progress", count);
    };
    #[cfg(windows)]
    if is_ntfs(&path) && is_admin() {
        if let Some(result) = scan_dir_mft(&path, &emit) {
            return result;
        }
    }
    scan_dir_winapi(&path, &emit)
}

#[tauri::command]
pub fn get_dir_children(path: String, app: tauri::AppHandle) -> Vec<FileEntry> {
    let emit = |count: u64| {
        let _ = app.emit("scan_progress", count);
    };
    #[cfg(windows)]
    if is_ntfs(&path) && is_admin() {
        if let Some(result) = scan_dir_mft(&path, &emit) {
            return result.entries;
        }
    }
    scan_dir_winapi(&path, &emit).entries
}

// ─── Windows API path (universal fallback) ───────────────────────────────────

fn scan_dir_winapi(path: &str, emit: &impl Fn(u64)) -> ScanResult {
    let root = std::path::Path::new(path);
    if !root.exists() {
        return ScanResult {
            path: path.to_string(),
            entries: vec![],
            total: 0,
        };
    }

    let mut entries: Vec<FileEntry> = Vec::new();
    let mut count: u64 = 0;

    for e in WalkDir::new(root)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if let Some(fe) = build_entry(e.path()) {
            entries.push(fe);
            count += 1;
            if count % 25 == 0 {
                emit(count);
            }
        }
    }
    emit(count);

    let total: u64 = entries.iter().map(|e| e.size_bytes).sum();
    ScanResult {
        path: path.to_string(),
        entries,
        total,
    }
}
