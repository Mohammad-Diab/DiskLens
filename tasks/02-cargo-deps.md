# Task 02 — Cargo Dependencies

**Phase**: 1 — Foundation
**Status**: [ ] Not started
**File**: `src-tauri/Cargo.toml`

## Goal
Add all required Rust crates to Cargo.toml.

## Dependencies to add

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-build = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sysinfo = "0.30"
trash = "3"
sha2 = "0.10"
hex = "0.4"
chrono = { version = "0.4", features = ["serde"] }
walkdir = "2"

[target.'cfg(windows)'.dependencies]
winapi = { version = "0.3", features = [
  "fileapi",
  "handleapi",
  "winbase",
  "windef",
  "winerror",
  "winnt",
  "minwinbase",
] }
ntfs = "0.4"
```

## Notes
- `ntfs` crate is for Phase 2 MFT path — add now so it's ready
- `sha2` + `hex` are for generating stable `id` field per FileEntry
- `chrono` is for formatting timestamps as ISO 8601
- `winapi` features: add only what's needed for `FindFirstFile`/`FindNextFile` + `GetVolumeInformation`
- After editing, run `cargo check` from `src-tauri/` to confirm no errors
