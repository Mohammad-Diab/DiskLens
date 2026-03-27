# Task 16 — system Rust Commands

**Phase**: 2 — Core Features
**Status**: [ ] Not started
**File**: `src-tauri/src/commands/system.rs`

## Goal
Implement utility commands: open file in Explorer, copy text to clipboard, get detailed file info.

## Commands

### open_in_explorer
```rust
#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
```
- Opens Windows Explorer with the file/folder selected (or directory opened)
- For selecting a file: use `explorer /select,<path>`

### copy_to_clipboard
```rust
#[tauri::command]
pub fn copy_to_clipboard(text: String, app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}
```
- Use Tauri clipboard plugin — not a raw winapi call
- May need `tauri-plugin-clipboard-manager` in Cargo.toml

### get_file_info
```rust
#[tauri::command]
pub fn get_file_info(path: String) -> Result<FileEntry, String> {
    // Build a single FileEntry from a path
    // Same logic as scan_dir but for one item
    // Used by the side panel to refresh info
}
```

## Notes
- `open_in_explorer` on a file should use `/select,` flag to highlight it
- For clipboard, check if `tauri-plugin-clipboard-manager` needs to be added to `Cargo.toml` and `tauri.conf.json`
- Register all three in `lib.rs` (Task 05)
