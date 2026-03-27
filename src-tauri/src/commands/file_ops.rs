use std::path::Path;

#[tauri::command]
pub async fn delete_to_trash(paths: Vec<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        for path in &paths {
            trash::delete(path).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_permanent(paths: Vec<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        for path in &paths {
            let p = Path::new(path);
            if p.is_dir() {
                std::fs::remove_dir_all(p).map_err(|e| e.to_string())?;
            } else {
                std::fs::remove_file(p).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
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
