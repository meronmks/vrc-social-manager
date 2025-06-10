use once_cell::sync::Lazy;
use reqwest::Client;
use reqwest_cookie_store::{CookieStore, CookieStoreMutex};
use serde::de;
use std::sync::Arc;
use log::{debug, error, warn, LevelFilter};
use tauri::{Manager, WindowEvent};
use tauri_plugin_store::StoreExt;

mod commands;
mod structs;

static COOKIE_STORE: Lazy<Arc<CookieStoreMutex>> = Lazy::new(|| {
    // デフォルトのCookieStoreを作成
    Arc::new(CookieStoreMutex::new(CookieStore::default()))
});

static CLIENT: Lazy<Arc<Client>> = Lazy::new(|| {
    let cookie_store = COOKIE_STORE.clone();
    let client = Client::builder()
        .cookie_provider(cookie_store)
        .user_agent("VSM/1.0/meronmks.8914@gmail.com")
        .build()
        .unwrap();

    Arc::new(client)
});

async fn save_cookies(app_handle: &tauri::AppHandle, user_id: &str) -> Result<(), Box<dyn std::error::Error>> {
    let store = app_handle.store(format!("cookies_{}.json",user_id))?;
    let cookie_store = COOKIE_STORE.lock().unwrap();
    let json_value = serde_json::to_value(&*cookie_store)?;
    // ignoring the result of set since it can't fail
    let _ = store.set("cookies", json_value);
    store.save()?;
    Ok(())
}

fn load_cookies(app_handle: &tauri::AppHandle, user_id: &str) -> Result<(), Box<dyn std::error::Error>> {
    debug!("Loading cookies for user: {}", user_id);
    let store = app_handle.store(format!("cookies_{}.json",user_id))?;
    if let Some(cookies) = store.get("cookies") {
        if let Ok(cookie_store) = serde_json::from_value::<CookieStore>(cookies) {
            let mut current_store = COOKIE_STORE.lock().unwrap();
            *current_store = cookie_store;
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(all(dev, not(any(target_os = "android", target_os = "ios"))))]
    commands::export_ts();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .clear_targets()
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .level(
                    #[cfg(debug_assertions)]
                    LevelFilter::Debug,
                    #[cfg(not(debug_assertions))]
                    LevelFilter::Info
                )
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .targets([
                     tauri_plugin_log::Target::new(
                         tauri_plugin_log::TargetKind::LogDir {
                             file_name: Some("app".to_string()),
                         },
                     ),
                     tauri_plugin_log::Target::new(
                         tauri_plugin_log::TargetKind::Stdout,
                     ),
                ])
                .build()
        )
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(commands::handlers())
        .setup(move |app| {
            let store = app.store("store.json").unwrap();

            match store.get("user-data") {
                Some(_) => {
                    store.delete("user-data");
                },
                _ => {
                    debug!("User data not found");
                }
            }
            
            match store.get("current-user-id") {
                Some(user_id) if user_id.is_string() => {
                    // アプリケーション起動時にCookieを読み込む
                    if let Err(e) = load_cookies(&app.handle(), user_id.as_str().unwrap()) {
                        error!("Failed to load cookies: {}", e);
                    }
                },
                _ => {
                    warn!("Current user ID is not set or not a string");
                }
            }

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
                window.close_devtools();
            }
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { .. } => {
                let app = window.app_handle();
                // アプリケーション終了時にCookieを保存
                tauri::async_runtime::block_on(async {
                    let store = app.store("store.json").unwrap();
                    match store.get("current-user-id") {
                        Some(user_id) if user_id.is_string() => {
                            if let Err(e) = save_cookies(&app, user_id.as_str().unwrap()).await {
                                error!("Failed to save cookies: {}", e);
                            }
                        },
                        _ => {
                            debug!("Current user ID is not set or not a string");
                        }
                    }
                });
                let store = app.store("store.json").unwrap();
                store.delete("instances-data");
                let _ = store.save();
            }
            _ => {}
        })
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
