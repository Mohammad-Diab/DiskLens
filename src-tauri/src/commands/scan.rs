use crate::models::{DiskInfo, FileEntry, FileKind, ScanResult};
use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};
use std::time::SystemTime;
use sysinfo::Disks;
use walkdir::WalkDir;

#[cfg(windows)]
use std::os::windows::fs::MetadataExt;

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

fn size_on_disk(size: u64) -> u64 {
    const CLUSTER: u64 = 4096;
    if size == 0 {
        0
    } else {
        ((size + CLUSTER - 1) / CLUSTER) * CLUSTER
    }
}

#[cfg(windows)]
fn file_attributes(meta: &std::fs::Metadata) -> (bool, bool, bool) {
    let attrs = meta.file_attributes();
    let is_hidden = attrs & winapi::um::winnt::FILE_ATTRIBUTE_HIDDEN != 0;
    let is_read_only = attrs & winapi::um::winnt::FILE_ATTRIBUTE_READONLY != 0;
    let is_system = attrs & winapi::um::winnt::FILE_ATTRIBUTE_SYSTEM != 0;
    (is_hidden, is_read_only, is_system)
}

#[cfg(not(windows))]
fn file_attributes(_meta: &std::fs::Metadata) -> (bool, bool, bool) {
    (false, false, false)
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

    let (is_hidden, is_read_only, is_system) = file_attributes(&meta);

    Some(FileEntry {
        id: hash_path(&path_str),
        name,
        path: path_str,
        kind: FileKind::from_path(path, is_dir),
        size_bytes,
        size_on_disk: size_on_disk(size_bytes),
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
pub fn scan_dir(path: String, _depth: Option<u32>) -> ScanResult {
    scan_dir_winapi(&path)
}

#[tauri::command]
pub fn get_dir_children(path: String) -> Vec<FileEntry> {
    scan_dir_winapi(&path).entries
}

fn scan_dir_winapi(path: &str) -> ScanResult {
    let root = std::path::Path::new(path);
    if !root.exists() {
        return ScanResult {
            path: path.to_string(),
            entries: vec![],
            total: 0,
        };
    }

    let entries: Vec<FileEntry> = WalkDir::new(root)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter_map(|e| build_entry(e.path()))
        .collect();

    let total: u64 = entries.iter().map(|e| e.size_bytes).sum();

    ScanResult {
        path: path.to_string(),
        entries,
        total,
    }
}
