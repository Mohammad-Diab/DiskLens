use crate::models::FileEntry;

#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
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
}

#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    use std::io::Write;
    // Use clip.exe on Windows — always available
    let mut child = std::process::Command::new("clip")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
    }
    child.wait().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_file_info(path: String) -> Result<FileEntry, String> {
    use crate::commands::scan::build_entry_pub;
    let p = std::path::Path::new(&path);
    build_entry_pub(p).ok_or_else(|| format!("could not read: {}", path))
}
