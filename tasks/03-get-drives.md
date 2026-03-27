# Task 03 — get_drives Command

**Phase**: 1 — Foundation
**Status**: [ ] Not started
**File**: `src-tauri/src/commands/scan.rs`

## Goal
Implement `get_drives()` Tauri command that returns all mounted Windows drives with filesystem info and usage stats.

## Signature
```rust
#[tauri::command]
pub fn get_drives() -> Vec<DiskInfo>
```

## Implementation approach
Use `sysinfo` crate:
```rust
use sysinfo::{DiskExt, System, SystemExt};

let mut sys = System::new_all();
sys.refresh_disks_list();
sys.disks().iter().map(|disk| DiskInfo {
    drive_letter: disk.mount_point().to_string_lossy().to_string(),
    label:        disk.name().to_string_lossy().to_string(),
    filesystem:   String::from_utf8_lossy(disk.file_system()).to_string(),
    total_bytes:  disk.total_space(),
    used_bytes:   disk.total_space() - disk.available_space(),
    free_bytes:   disk.available_space(),
}).collect()
```

## Notes
- Returns empty Vec on error (don't panic)
- Drive letter format should be `"C:\\"` (matches Windows path convention)
- Must be registered in `lib.rs` (Task 05)
