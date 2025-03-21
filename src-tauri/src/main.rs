// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::time;
use std::{fmt::Display, fs, path::PathBuf};
use reqwest_cookie_store::{CookieStore, CookieStoreMutex};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use specta_typescript::Typescript;
use tauri::Manager;
use tauri::State;
use tauri_specta::{collect_commands, Builder};
use once_cell::sync::Lazy;
use reqwest::{Client, cookie::Jar};
use std::sync::Arc;
use tokio::sync::Mutex;
use dirs::config_dir;

mod commands;

fn get_cookie_path() -> PathBuf {
    let mut path = config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("com.meronmks.vsm");
    std::fs::create_dir_all(&path).ok();
    path.push("cookies.json");
    path
}

static COOKIE_STORE: Lazy<Arc<CookieStoreMutex>> = Lazy::new(|| {
    let cookie_path = get_cookie_path();
    let cookie_store = match fs::read_to_string(cookie_path) {
        Ok(data) => match serde_json::from_str::<CookieStore>(&data) {
            Ok(store) => CookieStoreMutex::new(store),
            Err(_) => CookieStoreMutex::new(CookieStore::default()),
        },
        Err(_) => CookieStoreMutex::new(CookieStore::default()),
    };
    Arc::new(cookie_store)
});

static CLIENT: Lazy<Arc<Mutex<Client>>> = Lazy::new(|| {
    let cookie_store  = COOKIE_STORE.clone();
    let client = Client::builder()
        .cookie_provider(cookie_store)
        .user_agent("VSM/1.0/meronmks.8914@gmail.com")
        .build()
        .unwrap();

    Arc::new(Mutex::new(client))
});

async fn save_cookies() -> Result<(), Box<dyn std::error::Error>> {
    let cookie_path = get_cookie_path();
    let cookie_store = COOKIE_STORE.lock().unwrap();
    let json = serde_json::to_string_pretty(&*cookie_store)?;
    fs::write(cookie_path, json)?;
    Ok(())
}

#[derive(Serialize, Deserialize)]
#[allow(non_snake_case)]
struct World {
    id: String,
    name: String,
    thumbnailImageUrl: String,
}

#[derive(Default)]
struct Worlds {
    world: HashMap<String, World>,
}

#[derive(Default)]
struct AppState {
    is_login: bool,
    worlds: Worlds,
}

fn main() {

    #[cfg(dev)]
    commands::export_ts();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(commands::handlers())
        .setup(move |app| {
            app.manage(Mutex::new(AppState::default()));
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
