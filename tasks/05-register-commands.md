# Task 05 — Register Commands in lib.rs

**Phase**: 1 — Foundation
**Status**: [ ] Not started
**File**: `src-tauri/src/lib.rs`

## Goal
Wire up all Tauri command modules and register every command in the invoke handler.

## lib.rs structure

```rust
mod models;
mod commands {
    pub mod scan;
    pub mod file_ops;
    pub mod system;
}

use commands::{scan, file_ops, system};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // scan
            scan::get_drives,
            scan::scan_dir,
            scan::get_dir_children,
            // file_ops
            file_ops::delete_to_trash,
            file_ops::delete_permanent,
            file_ops::rename_file,
            // system
            system::open_in_explorer,
            system::copy_to_clipboard,
            system::get_file_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Notes
- All commands must be listed here or they won't be callable from the frontend
- `main.rs` just calls `lib::run()` — keep main.rs minimal
- Create stub implementations in `file_ops.rs` and `system.rs` so this compiles (Task 15 and 16 will fill them in)
- After wiring, run `cargo check` to verify compilation
