use crate::models::FileEntry;

#[tauri::command]
pub fn pick_folder() -> Option<String> {
    let script = r#"
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = 'Select a folder'
$d.RootFolder = [System.Environment+SpecialFolder]::MyComputer
$d.ShowNewFolderButton = $false
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $d.SelectedPath }
"#;
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", script])
        .output()
        .ok()?;
    let result = String::from_utf8_lossy(&output.stdout)
        .trim()
        .replace("\r\n", "")
        .replace('\r', "")
        .replace('\n', "");
    if result.is_empty() { None } else { Some(result) }
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
