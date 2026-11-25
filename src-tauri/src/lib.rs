#[cfg(dev)]
use once_cell::sync::Lazy;
#[cfg(dev)]
use reqwest::Client;
#[cfg(dev)]
use reqwest_cookie_store::{CookieStore, CookieStoreMutex};
#[cfg(dev)]
use std::sync::Arc;
use log::LevelFilter;
#[cfg(dev)]
use log::debug;
use tauri::{Manager, WindowEvent};
use tauri_plugin_store::StoreExt;
#[cfg(dev)]
use keyring::Entry;

#[cfg(desktop)]
mod updates;
mod commands;
mod structs;
mod social;
mod cache;
mod account_migration;
mod preferences;
mod logs;

#[cfg(dev)]
static COOKIE_STORE: Lazy<Arc<CookieStoreMutex>> = Lazy::new(|| {
    // デフォルトのCookieStoreを作成
    Arc::new(CookieStoreMutex::new(CookieStore::default()))
});

const USER_AGENT: &str = "VSM/1.0/meronmks.8914@gmail.com";

#[cfg(dev)]
static CLIENT: Lazy<Arc<Client>> = Lazy::new(|| {
    let cookie_store = COOKIE_STORE.clone();
    let client = Client::builder()
        .cookie_provider(cookie_store)
        .user_agent(USER_AGENT)
        .build()
        .unwrap();

    Arc::new(client)
});

#[cfg(dev)]
async fn save_cookies(app_handle: &tauri::AppHandle, user_id: &str) -> Result<(), Box<dyn std::error::Error>> {
    let cookie_store = COOKIE_STORE.lock()?;
    let json_value = serde_json::to_string(&*cookie_store)?;
    let entry = Entry::new(&app_handle.config().identifier, user_id)?;
    entry.set_password(&json_value)?;
    Ok(())
}

#[cfg(dev)]
fn load_cookies(app_handle: &tauri::AppHandle, user_id: &str) -> Result<(), Box<dyn std::error::Error>> {
    debug!("登録済みの認証情報を読み込みます");
    let entry = Entry::new(&app_handle.config().identifier, user_id)?;
    let cookie = entry.get_password()?;
    let cookie_store = serde_json::from_str(&cookie)?;
    let mut current_store = COOKIE_STORE.lock()?;
    *current_store = cookie_store;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(all(dev, not(any(target_os = "android", target_os = "ios"))))]
    commands::export_ts();

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(commands::handlers())
        // 認証が必要な VRChat の画像を、IPC を通さず `<img>` から直接読めるようにする。
        .register_asynchronous_uri_scheme_protocol(social::IMAGE_SCHEME, |_ctx, request, responder| {
            tauri::async_runtime::spawn(async move {
                responder.respond(social::image_response(request).await);
            });
        })
        .setup(move |app| {
            // ログファイルの上限は設定から決めるため、設定ストアを読める setup で最初に初期化する。
            // ロガーは起動中に作り直せないので、設定の変更は次回起動から反映される。
            let (file_size_mb, files_kept) = preferences::log_limits(app.handle());
            app.handle().plugin(
                tauri_plugin_log::Builder::new()
                    .clear_targets()
                    .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                    .level(
                        #[cfg(debug_assertions)]
                        LevelFilter::Debug,
                        #[cfg(not(debug_assertions))]
                        LevelFilter::Info
                    )
                    // HTTP・Cookie・資格情報ライブラリの診断には秘密値が含まれることがある。
                    .filter(|record| record.target().starts_with("vsm_lib::") || record.target() == "vsm_lib" || record.target().starts_with(tauri_plugin_log::WEBVIEW_TARGET))
                    // ログファイルは 1 つ file_size_mb までとし、切り替えた古いファイルは新しい順に
                    // files_kept 個だけ残す。起動時にも上限を超えた古いファイルを削除する。
                    .max_file_size(u128::from(file_size_mb) * 1024 * 1024)
                    .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(files_kept as usize))
                    .targets([
                        tauri_plugin_log::Target::new(
                            tauri_plugin_log::TargetKind::LogDir {
                                file_name: Some("app".to_string()),
                            },
                        ),
                        tauri_plugin_log::Target::new(
                            tauri_plugin_log::TargetKind::Stdout,
                        ),
                        // 設定画面の「動作ログ」で読めるよう、直近のログをメモリにも残す。
                        logs::target(),
                    ])
                    .build(),
            )?;

            let store = app.store("store.json")?;
            account_migration::migrate(&store)?;
            preferences::apply_cache_limits(app.handle());

            #[cfg(all(dev, debug_assertions))]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
                window.close_devtools();
            }
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            #[cfg(desktop)]
            app.manage(updates::PendingUpdate::default());
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { .. } => {
                let app = window.app_handle();
                social::save_active(app);
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
