# Task 11 — MFT Fast Path (NTFS + Admin)

**Phase**: 2 — Core Features
**Status**: [ ] Not started
**File**: `src-tauri/src/commands/scan.rs`

## Goal
Add the fast MFT-based scan path to `scan_dir`. Auto-detect at runtime: if NTFS + running as admin, use MFT. Otherwise fall back to the Windows API path from Task 04.

## Detection logic

```rust
fn should_use_mft(path: &str) -> bool {
    is_ntfs(path) && is_admin()
}

fn is_ntfs(path: &str) -> bool {
    // Use GetVolumeInformation winapi call
    // Return true if filesystem name == "NTFS"
}

fn is_admin() -> bool {
    // Check token elevation on Windows
    // Use winapi IsUserAnAdmin or check token privileges
}
```

## MFT scan with `ntfs` crate
- Open the raw device (`\\.\C:`) as a file
- Parse MFT entries for the target directory and its children
- Build `FileEntry` structs from MFT record fields
- Same output shape as the Windows API path

## Integration into scan_dir
```rust
pub fn scan_dir(path: String, depth: Option<u32>) -> ScanResult {
    if should_use_mft(&path) {
        scan_dir_mft(&path)
    } else {
        scan_dir_winapi(&path)
    }
}
```

## Notes
- MFT requires elevation — if it fails at runtime, silently fall back to Windows API
- Both paths must return identical `Vec<FileEntry>` shape
- MFT path should be noticeably faster for large directories (benchmark target: 50k files in < 2s)
- This is Phase 2 — only implement after Phase 1 Windows API path is working and tested
