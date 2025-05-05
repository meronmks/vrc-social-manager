use once_cell::sync::Lazy;
use reqwest::Client;
use reqwest_cookie_store::{CookieStore, CookieStoreMutex};
use std::sync::Arc;
use tauri::{Manager, WindowEvent};
use tauri_plugin_store::StoreExt;

mod commands;
mod structs;

const COOKIE_STORE_NAME: &str = "cookies.json";

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

async fn save_cookies(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let store = app_handle.store(COOKIE_STORE_NAME)?;
    let cookie_store = COOKIE_STORE.lock().unwrap();
    let json_value = serde_json::to_value(&*cookie_store)?;
    // ignoring the result of set since it can't fail
    let _ = store.set("cookies", json_value);
    store.save()?;
    Ok(())
}

fn load_cookies(app_handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let store = app_handle.store(COOKIE_STORE_NAME)?;
    // store.get returns Option<JsonValue>
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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(commands::handlers())
        .setup(move |app| {
            // アプリケーション起動時にCookieを読み込む
            if let Err(e) = load_cookies(&app.handle()) {
                eprintln!("Failed to load cookies: {}", e);
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
                    if let Err(e) = save_cookies(&app).await {
                        eprintln!("Failed to save cookies: {}", e);
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
