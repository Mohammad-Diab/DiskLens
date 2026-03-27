use crate::models::FileEntry;

#[tauri::command]
pub fn pick_folder() -> Option<String> {
    // rfd uses IFileOpenDialog (modern Windows Explorer-style picker)
    // Spawn a dedicated thread so COM STA is properly initialized
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let result = rfd::FileDialog::new().pick_folder();
        let _ = tx.send(result);
    });
    rx.recv()
        .ok()
        .flatten()
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_path_suggestions(partial: String) -> Vec<String> {
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
}

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
