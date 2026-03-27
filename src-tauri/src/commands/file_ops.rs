// Stub — full implementation in Task 15

#[tauri::command]
pub fn delete_to_trash(_paths: Vec<String>) -> Result<(), String> {
    Err("not implemented".to_string())
}

#[tauri::command]
pub fn delete_permanent(_paths: Vec<String>) -> Result<(), String> {
    Err("not implemented".to_string())
}

#[tauri::command]
pub fn rename_file(_path: String, _new_name: String) -> Result<(), String> {
    Err("not implemented".to_string())
}
