# Task 15 — file_ops Rust Commands

**Phase**: 2 — Core Features
**Status**: [ ] Not started
**File**: `src-tauri/src/commands/file_ops.rs`

## Goal
Implement delete (trash + permanent) and rename file operations in Rust.

## Commands

### delete_to_trash
```rust
#[tauri::command]
pub fn delete_to_trash(paths: Vec<String>) -> Result<(), String> {
    for path in &paths {
        trash::delete(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
```
- Use `trash` crate — never `std::fs::remove_file` or `std::fs::remove_dir_all`
- If any path fails, return early with the error message

### delete_permanent
```rust
#[tauri::command]
pub fn delete_permanent(paths: Vec<String>) -> Result<(), String> {
    for path in &paths {
        let p = std::path::Path::new(path);
        if p.is_dir() {
            std::fs::remove_dir_all(p).map_err(|e| e.to_string())?;
        } else {
            std::fs::remove_file(p).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
```

### rename_file
```rust
#[tauri::command]
pub fn rename_file(path: String, new_name: String) -> Result<(), String> {
    let old = std::path::Path::new(&path);
    let new = old.parent()
        .ok_or("no parent")?
        .join(&new_name);
    std::fs::rename(old, new).map_err(|e| e.to_string())
}
```

## Notes
- `trash` crate must be in Cargo.toml (Task 02)
- All commands return `Result<(), String>` — frontend checks for errors
- Register all three in `lib.rs` (Task 05)
