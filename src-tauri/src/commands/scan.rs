use crate::models::{DiskInfo, FileEntry, FileKind, ScanResult};
use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::SystemTime;
use sysinfo::Disks;
use tauri::Emitter;

#[cfg(windows)]
use std::os::windows::fs::MetadataExt;

// ─── Scan control state (managed by Tauri) ────────────────────────────────────

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

/// Normalize a path: drive roots get a trailing backslash ("C:" → "C:\"),
/// all other paths strip trailing slashes.
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
    let is_hidden    = attrs & 0x2 != 0; // FILE_ATTRIBUTE_HIDDEN
    let is_read_only = attrs & 0x1 != 0; // FILE_ATTRIBUTE_READONLY
    let is_system    = attrs & 0x4 != 0; // FILE_ATTRIBUTE_SYSTEM
    (is_hidden, is_read_only, is_system)
}

#[cfg(not(windows))]
fn file_attributes_from_meta(_meta: &std::fs::Metadata) -> (bool, bool, bool) {
    (false, false, false)
}

/// Build a single FileEntry for a path (used by get_file_info).
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
    // Reset control flags at the start of every new scan
    scan_control.stop.store(false, Ordering::SeqCst);
    scan_control.paused.store(false, Ordering::SeqCst);

    let stop   = Arc::clone(&scan_control.stop);
    let paused = Arc::clone(&scan_control.paused);

    Ok(tauri::async_runtime::spawn_blocking(move || {
        let emit = |count: u64| { let _ = app.emit("scan_progress", count); };
        scan_recursive(&path, &emit, &stop, &paused)
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

// ─── Recursive scan ───────────────────────────────────────────────────────────

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

fn scan_recursive(
    root: &str,
    emit: &impl Fn(u64),
    stop: &Arc<AtomicBool>,
    paused: &Arc<AtomicBool>,
) -> ScanResult {
    let root = normalize_path(root);

    if !std::path::Path::new(&root).exists() {
        return ScanResult { path: root, entries: vec![], total: 0 };
    }

    let mut raw: Vec<RawEntry> = Vec::new();
    let mut count: u64 = 0;
    let mut stack: Vec<std::path::PathBuf> = vec![std::path::PathBuf::from(&root)];

    'outer: while let Some(dir) = stack.pop() {
        // Check pause: spin-wait until resumed or stopped
        while paused.load(Ordering::Relaxed) {
            if stop.load(Ordering::Relaxed) { break 'outer; }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        if stop.load(Ordering::Relaxed) { break; }

        let Ok(read_dir) = std::fs::read_dir(&dir) else { continue; };
        let dir_str = normalize_path(&dir.to_string_lossy());

        for entry in read_dir.filter_map(|e| e.ok()) {
            // Check stop periodically
            if count % 500 == 0 && stop.load(Ordering::Relaxed) {
                break 'outer;
            }

            let path = entry.path();
            let meta = match std::fs::symlink_metadata(&path) {
                Ok(m) => m,
                Err(_) => continue,
            };

            if meta.file_type().is_symlink() { continue; }

            #[cfg(windows)]
            if meta.file_attributes() & 0x400 != 0 { continue; }

            let is_dir       = meta.is_dir();
            let raw_size     = if is_dir { 0 } else { meta.len() };
            let size_on_disk = cluster_round(raw_size);
            let (is_hidden, is_read_only, is_system) = file_attributes_from_meta(&meta);
            let path_str = normalize_path(&path.to_string_lossy());
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            raw.push(RawEntry {
                path: path_str.clone(),
                parent: dir_str.clone(),
                name,
                is_dir,
                raw_size,
                size_on_disk,
                modified: system_time_to_iso(meta.modified()),
                accessed: system_time_to_iso(meta.accessed()),
                is_hidden,
                is_read_only,
                is_system,
            });

            count += 1;
            if count % 1000 == 0 { emit(count); }

            if is_dir { stack.push(path); }
        }
    }
    emit(count);

    // ── Compute cumulative folder sizes ───────────────────────────────────

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

    // ── Direct child counts ───────────────────────────────────────────────

    let mut child_files_map:   HashMap<String, u64> = HashMap::new();
    let mut child_folders_map: HashMap<String, u64> = HashMap::new();
    for e in &raw {
        if e.is_dir { *child_folders_map.entry(e.parent.clone()).or_insert(0) += 1; }
        else        { *child_files_map.entry(e.parent.clone()).or_insert(0)   += 1; }
    }

    // ── Build FileEntry vec ───────────────────────────────────────────────

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
