// Stub — full implementation in Task 16

use crate::models::FileEntry;

#[tauri::command]
pub fn open_in_explorer(_path: String) -> Result<(), String> {
    Err("not implemented".to_string())
}

#[tauri::command]
pub fn copy_to_clipboard(_text: String) -> Result<(), String> {
    Err("not implemented".to_string())
}

#[tauri::command]
pub fn get_file_info(_path: String) -> Result<FileEntry, String> {
    Err("not implemented".to_string())
}
