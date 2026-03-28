use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum FileKind {
    Folder,
    Program,
    Document,
    Image,
    Video,
    System,
    Archive,
    Other,
}

impl FileKind {
    pub fn from_path(path: &std::path::Path, is_dir: bool) -> Self {
        if is_dir {
            return FileKind::Folder;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        match ext.as_str() {
            "exe" | "msi" | "dll" | "bat" | "cmd" | "ps1" => FileKind::Program,
            "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "md" | "csv" => {
                FileKind::Document
            }
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "svg" | "webp" | "ico" => FileKind::Image,
            "mp4" | "mkv" | "avi" | "mov" | "wmv" | "flv" | "webm" => FileKind::Video,
            "sys" | "inf" | "reg" | "cab" | "tmp" => FileKind::System,
            "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" => FileKind::Archive,
            _ => FileKind::Other,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    pub parent: String,
    pub kind: FileKind,
    pub size_bytes: u64,
    pub size_on_disk: u64,
    pub pct_disk: f64,
    pub pct_parent: f64,
    pub modified: String,
    pub accessed: String,
    pub is_hidden: bool,
    pub is_read_only: bool,
    pub is_system: bool,
    pub child_files: u64,
    pub child_folders: u64,
    pub total_items: u64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiskInfo {
    pub drive_letter: String,
    pub label: String,
    pub filesystem: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub path: String,
    pub entries: Vec<FileEntry>,
    pub total: u64,
    /// Size of every scanned directory (path → bytes). Used by the frontend to
    /// populate knownTotals so lazy-navigated sub-folders show correct sizes.
    pub folder_sizes: std::collections::HashMap<String, u64>,
}
