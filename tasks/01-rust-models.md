# Task 01 — Rust Models

**Phase**: 1 — Foundation
**Status**: [ ] Not started
**File**: `src-tauri/src/models.rs`

## Goal
Define all shared data structs that the Rust backend serializes and sends to the frontend via Tauri's JSON bridge.

## Structs to implement

### FileEntry
```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub id:            String,   // SHA of full path
    pub name:          String,
    pub path:          String,
    pub kind:          FileKind,
    pub size_bytes:    u64,
    pub size_on_disk:  u64,
    pub pct_disk:      f64,
    pub pct_parent:    f64,
    pub modified:      String,   // ISO 8601
    pub accessed:      String,   // ISO 8601
    pub is_hidden:     bool,
    pub is_read_only:  bool,
    pub is_system:     bool,
    pub child_files:   u64,
    pub child_folders: u64,
    pub total_items:   u64,
}
```

### FileKind enum
```rust
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum FileKind {
    Folder, Program, Document, Image, Video, System, Archive, Other,
}
```

Classify by extension:
- Folder → is_dir
- Program → .exe .msi .dll .bat .cmd .ps1
- Document → .pdf .doc .docx .xls .xlsx .ppt .pptx .txt .md .csv
- Image → .jpg .jpeg .png .gif .bmp .svg .webp .ico
- Video → .mp4 .mkv .avi .mov .wmv .flv .webm
- System → .sys .inf .reg .cab .tmp
- Archive → .zip .rar .7z .tar .gz .bz2 .xz
- Other → everything else

### DiskInfo
```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct DiskInfo {
    pub drive_letter: String,
    pub label:        String,
    pub filesystem:   String,   // "NTFS", "FAT32", etc.
    pub total_bytes:  u64,
    pub used_bytes:   u64,
    pub free_bytes:   u64,
}
```

### ScanResult
```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct ScanResult {
    pub path:    String,
    pub entries: Vec<FileEntry>,
    pub total:   u64,   // total bytes of all entries
}
```

## Notes
- All structs need `#[derive(Serialize, Deserialize, Clone)]`
- Serde field naming: use `rename_all = "camelCase"` on each struct so JSON keys match the TypeScript interfaces
- Add `use serde::{Serialize, Deserialize};` at top of file
- This file has no Tauri commands — it's data only
