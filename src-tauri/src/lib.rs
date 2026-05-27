mod commands;
mod tray;

use commands::{AppState, load_config};
use std::sync::Mutex;
use tauri::Manager;

#[tauri::command]
fn set_window_size(app: tauri::AppHandle, width: f64, height: f64) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: width as u32,
            height: height as u32,
        }));
    }
}

#[tauri::command]
fn set_window_position(app: tauri::AppHandle, x: f64, y: f64) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: x as i32,
            y: y as i32,
        }));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let config = load_config(app.handle());
            let config_path = commands::get_config_path(app.handle());

            app.manage(AppState {
                config: Mutex::new(config),
                history: Mutex::new(Vec::new()),
                config_path: Mutex::new(config_path),
            });
            tray::setup_tray(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_shadow(false);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::chat,
            commands::get_config,
            commands::set_config,
            commands::clear_history,
            set_window_size,
            set_window_position,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
