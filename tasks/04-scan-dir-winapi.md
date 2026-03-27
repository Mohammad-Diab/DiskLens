# Task 04 — scan_dir Command (Windows API)

**Phase**: 1 — Foundation
**Status**: [ ] Not started
**File**: `src-tauri/src/commands/scan.rs`

## Goal
Implement `scan_dir()` using `FindFirstFile`/`FindNextFile` Windows API (universal fallback path). This is the core command of the entire app.

## Signatures
```rust
#[tauri::command]
pub fn scan_dir(path: String, depth: Option<u32>) -> ScanResult

#[tauri::command]
pub fn get_dir_children(path: String) -> Vec<FileEntry>
```

## scan_dir implementation steps

1. **Validate path** — return empty ScanResult if path doesn't exist
2. **Iterate with walkdir** — use `walkdir::WalkDir::new(&path).min_depth(1).max_depth(1)` for direct children only
3. **For each entry**, build a `FileEntry`:
   - `id`: SHA-256 of the full path string, hex-encoded (first 16 chars is fine)
   - `name`: file_name component
   - `path`: full absolute path
   - `kind`: classify by extension (see Task 01)
   - `size_bytes`: for files = metadata.len(); for folders = 0 (async deep scan is separate)
   - `size_on_disk`: round up to nearest 4096 bytes cluster (approximate)
   - `modified` / `accessed`: from metadata, formatted as ISO 8601
   - `is_hidden` / `is_read_only` / `is_system`: from Windows file attributes via `metadata.file_attributes()`
   - `child_files`, `child_folders`, `total_items`: for Phase 1, set to 0 (expensive to compute)
   - `pct_disk` / `pct_parent`: set to 0.0 for now (computed after full scan)
4. **Collect** into `Vec<FileEntry>`
5. **Return** `ScanResult { path, entries, total: sum of size_bytes }`

## Windows file attributes (winapi)
```rust
use std::os::windows::fs::MetadataExt;
let attrs = metadata.file_attributes();
let is_hidden    = attrs & winapi::um::winnt::FILE_ATTRIBUTE_HIDDEN    != 0;
let is_read_only = attrs & winapi::um::winnt::FILE_ATTRIBUTE_READONLY  != 0;
let is_system    = attrs & winapi::um::winnt::FILE_ATTRIBUTE_SYSTEM    != 0;
```

## get_dir_children
Same logic as `scan_dir` but returns `Vec<FileEntry>` directly (no ScanResult wrapper). Used for lazy folder expansion.

## Notes
- Skip entries where `metadata()` returns an error (permissions, etc.) — don't abort the whole scan
- Use `chrono::DateTime` for ISO 8601 formatting from `SystemTime`
- Phase 1: depth is ignored — always scan 1 level deep
- **Performance gate**: must handle a folder with 50,000+ files before Phase 1 is done
