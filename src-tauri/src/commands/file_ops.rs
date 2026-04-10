use std::path::Path;

// ── Windows shell file operations ─────────────────────────────────────────────
//
// Both delete_to_trash and delete_permanent go through SHFileOperationW so
// Windows shows its native progress dialog ("Moving to Recycle Bin…" /
// "Deleting…"). FOF_SILENT is intentionally absent — that flag is what
// suppresses the dialog.
//
//   FOF_NOCONFIRMATION = 0x0010  suppress "Are you sure?" prompt (we show our own)
//   FOF_ALLOWUNDO      = 0x0040  move to Recycle Bin instead of deleting
//   FO_DELETE          = 0x0003  delete operation

#[cfg(windows)]
fn sh_file_op(paths: &[String], to_trash: bool) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use winapi::um::shellapi::{SHFileOperationW, SHFILEOPSTRUCTW};

    const FOF_NOCONFIRMATION: u16 = 0x0010;
    const FOF_ALLOWUNDO:      u16 = 0x0040;
    const FO_DELETE:          u32 = 0x0003;

    // Build double-null-terminated wide path list: path1\0path2\0\0
    let mut wide: Vec<u16> = Vec::new();
    for path in paths {
        wide.extend(OsStr::new(path).encode_wide());
        wide.push(0);
    }
    wide.push(0); // final extra null

    let flags: u16 = FOF_NOCONFIRMATION | if to_trash { FOF_ALLOWUNDO } else { 0 };

    let mut op = SHFILEOPSTRUCTW {
        hwnd:                  std::ptr::null_mut(),
        wFunc:                 FO_DELETE,
        pFrom:                 wide.as_ptr(),
        pTo:                   std::ptr::null(),
        fFlags:                flags,
        fAnyOperationsAborted: 0,
        hNameMappings:         std::ptr::null_mut(),
        lpszProgressTitle:     std::ptr::null(),
    };

    let ret = unsafe { SHFileOperationW(&mut op) };
    if ret != 0 {
        return Err(format!("SHFileOperationW failed: error code {}", ret));
    }
    if op.fAnyOperationsAborted != 0 {
        return Err("Operation was cancelled".to_string());
    }
    Ok(())
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn delete_to_trash(paths: Vec<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        return sh_file_op(&paths, true);

        #[cfg(not(windows))]
        trash::delete_all(&paths).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_permanent(paths: Vec<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        return sh_file_op(&paths, false);

        #[cfg(not(windows))]
        {
            for path in &paths {
                let p = Path::new(path);
                if p.is_dir() {
                    std::fs::remove_dir_all(p).map_err(|e| e.to_string())?;
                } else {
                    std::fs::remove_file(p).map_err(|e| e.to_string())?;
                }
            }
            Ok(())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn rename_file(path: String, new_name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let old = Path::new(&path);
        let new_path = old
            .parent()
            .ok_or("no parent directory")?
            .join(&new_name);
        std::fs::rename(old, new_path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
