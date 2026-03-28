use crate::models::FileEntry;

/// Open a file or folder with the OS default application.
#[tauri::command]
pub async fn open_path(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            std::process::Command::new("cmd")
                .args(["/c", "start", "", path.as_str()])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW — suppress cmd flash
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        #[cfg(not(windows))]
        {
            std::process::Command::new("xdg-open")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn pick_folder() -> Option<String> {
    tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new().pick_folder()
            .map(|p| p.to_string_lossy().to_string())
    })
    .await
    .ok()
    .flatten()
}

#[tauri::command]
pub async fn get_path_suggestions(partial: String) -> Vec<String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::path::Path;

        if partial.is_empty() {
            return vec![];
        }

        let p = Path::new(&partial);
        let (parent, prefix) = if partial.ends_with('\\') || partial.ends_with('/') {
            (p.to_path_buf(), String::new())
        } else {
            let par = p.parent().unwrap_or(p).to_path_buf();
            let pfx = p.file_name()
                .map(|n| n.to_string_lossy().to_lowercase())
                .unwrap_or_default()
                .to_string();
            (par, pfx)
        };

        let Ok(read) = std::fs::read_dir(&parent) else {
            return vec![];
        };

        let mut matches: Vec<String> = read
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
            .filter(|e| {
                let name = e.file_name().to_string_lossy().to_lowercase();
                prefix.is_empty() || name.starts_with(&prefix)
            })
            .map(|e| e.path().to_string_lossy().to_string())
            .collect();

        matches.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
        matches.truncate(10);
        matches
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub async fn open_in_explorer(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = std::path::Path::new(&path);
        let arg = if p.is_file() {
            format!("/select,{}", path)
        } else {
            path.clone()
        };
        std::process::Command::new("explorer")
            .arg(&arg)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn copy_to_clipboard(text: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::Write;
        let mut child = std::process::Command::new("clip")
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?;
        if let Some(stdin) = child.stdin.as_mut() {
            stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
        }
        child.wait().map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_file_info(path: String) -> Result<FileEntry, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use crate::commands::scan::build_entry_pub;
        let p = std::path::Path::new(&path);
        build_entry_pub(p).ok_or_else(|| format!("could not read: {}", path))
    })
    .await
    .map_err(|e| e.to_string())?
}
