pub mod models;
pub mod commands {
    pub mod file_ops;
    pub mod scan;
    pub mod system;
}

use commands::{file_ops, scan, system};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan::get_drives,
            scan::scan_dir,
            scan::get_dir_children,
            file_ops::delete_to_trash,
            file_ops::delete_permanent,
            file_ops::rename_file,
            system::open_in_explorer,
            system::copy_to_clipboard,
            system::get_file_info,
            system::pick_folder,
            system::get_path_suggestions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
