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

#[derive(Debug, Clone, Serialize, specta::Type)]
#[specta(export)]
#[serde(tag = "type")]
enum RustError {
    Unrecoverable { message: String },
}

impl RustError {
    fn unrecoverable<T: Display>(value: T) -> Self {
        Self::Unrecoverable {
            message: value.to_string(),
        }
    }
}

impl<E: Display> From<E> for RustError {
    fn from(value: E) -> Self {
        RustError::unrecoverable(format!("io error: {value}"))
    }
}

#[tauri::command]
#[specta::specta]
async fn cookieClear() {
    let cookie_store  = COOKIE_STORE.clone();
    cookie_store.lock().unwrap().clear();
    let _ = save_cookies().await;
}

#[tauri::command]
#[specta::specta]
async fn login(userName: &str, password: &str) -> Result<String, RustError> {
    let client = CLIENT.lock().await;

    let res = client.get("https://api.vrchat.cloud/api/1/auth/user")
        .basic_auth(userName, Some(password))
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => {
            save_cookies().await?;
            let res_text = res.error_for_status()?.text().await?;
            let res_json: serde_json::Value = serde_json::from_str(&res_text).unwrap();
            if res_json["requiresTwoFactorAuth"].is_array() {
                if res_json["requiresTwoFactorAuth"].as_array().unwrap().contains(&json!("emailOtp")) {
                    return Ok("emailOtp".to_string())
                } else {
                    return Ok("totp".to_string())
                }
            } else {
                return Ok(res_text)
            }
        },
        _ => {
            return Err("Login Failed...".into());
        },
    };
}

#[tauri::command]
#[specta::specta]
async fn emailOtp(otp: &str) -> Result<bool, RustError> {
    let client = CLIENT.lock().await;

    let res = client.post("https://api.vrchat.cloud/api/1/auth/twofactorauth/emailotp/verify")
        .json(&json!({"code": otp}))
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => {
            let res_text = res.error_for_status()?.text().await?;
            let res_json: serde_json::Value = serde_json::from_str(&res_text).unwrap();
            if res_json["verified"].is_boolean() {
                if res_json["verified"].as_bool().unwrap() {
                    save_cookies().await?;
                    return Ok(true);
                }
            }
            return Ok(false);
        },
        _ => {
            return Err("Login Failed...".into());
        },
    };
}

#[tauri::command]
#[specta::specta]
async fn twoFactorAuth(otp: &str) -> Result<bool, RustError> {
    let client = CLIENT.lock().await;

    let res = client.post("https://api.vrchat.cloud/api/1/auth/twofactorauth/totp/verify")
        .json(&json!({"code": otp}))
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => {
            let res_text = res.error_for_status()?.text().await?;
            let res_json: serde_json::Value = serde_json::from_str(&res_text).unwrap();
            if res_json["verified"].is_boolean() {
                if res_json["verified"].as_bool().unwrap() {
                    save_cookies().await?;
                    return Ok(true);
                }
            }
            return Ok(false);
        },
        _ => {
            return Err("Login Failed...".into());
        },
    };
}

#[tauri::command]
#[specta::specta]
async fn verifyAuthToken(state: State<'_, Mutex<AppState>>) -> Result<bool, RustError> {
    let client = CLIENT.lock().await;

    let res = client.get("https://api.vrchat.cloud/api/1/auth")
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => {
            let res_text = res.error_for_status()?.text().await?;
            let res_json: serde_json::Value = serde_json::from_str(&res_text).unwrap();
            if res_json["ok"].is_boolean() {
                if res_json["ok"].as_bool().unwrap() {
                    let mut state = state.lock().await;
                    state.is_login = true;
                    return Ok(true);
                }
            }
            return Ok(false);
        },
        _ => {
            return Err("Login Failed...".into());
        },
    };
}

#[tauri::command]
#[specta::specta]
async fn get_current_user_info() -> Result<String, RustError> {
    let client = CLIENT.lock().await;

    let res = client.get("https://api.vrchat.cloud/api/1/auth/user")
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => {
            let res_text = res.error_for_status()?.text().await.map_err(|e| e.to_string())?;
            return Ok(res_text);
        },
        _ => {
            return Err("Failed...".into());
        },
    };
}

#[tauri::command]
#[specta::specta]
async fn get_current_user_friends(offset: i32, n: i32, offline: bool) -> Result<String, RustError> {
    let client = CLIENT.lock().await;

    let res = client.get("https://api.vrchat.cloud/api/1/auth/user/friends")
        .query(&[("offset", offset), ("n", n)])
        .query(&[("offline", offline)])
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => {
            let res_text = res.error_for_status()?.text().await.map_err(|e| e.to_string())?;
            return Ok(res_text);
        },
        _ => {
            return Err("Failed...".into());
        },
    };
}

#[tauri::command]
#[specta::specta]
async fn get_world_by_id(state: State<'_, Mutex<AppState>>, worldid: &str) -> Result<String, RustError> {
    if worldid == "private" {
        let w = World{ id: "private".to_string(),  name: "In a private world".to_string(), thumbnailImageUrl: "https://assets.vrchat.com/www/images/user-location-private-world.png".to_string()};
        return Ok(serde_json::to_string(&w).unwrap());
    } else if worldid == "offline" {
        let w = World{ id: "offline".to_string(),  name: "On Web or Mobile".to_string(), thumbnailImageUrl: "https://assets.vrchat.com/www/images/user-location-private-world.png".to_string()};
        return Ok(serde_json::to_string(&w).unwrap());
    } else if worldid == "traveling" {
        let w = World{ id: "traveling".to_string(),  name: "In a traveling world".to_string(), thumbnailImageUrl: "https://assets.vrchat.com/www/images/user-location-private-world.png".to_string()};
        return Ok(serde_json::to_string(&w).unwrap());
    }

    println!("Call get_world_by_id {:?}", worldid);
    let now = time::Instant::now();

    let mut state = state.lock().await;

    let world = state.worlds.world.get(worldid);

    match world {
        Some(result) => {
            println!("Receive cached get_world_by_id {:?} time: {:?}", worldid, now.elapsed());
            return Ok(serde_json::to_string(&result).unwrap());
        },
        None => {
            let client = CLIENT.lock().await;

            let res = client.get(format!("https://api.vrchat.cloud/api/1/worlds/{worldid}"))
                .send()
                .await?;

            match res.status() {
                reqwest::StatusCode::OK => {
                    let res_text = res.error_for_status()?.text().await.map_err(|e| e.to_string())?;
                    let json = serde_json::from_str::<World>(&res_text);
                    match json {
                        Ok(o) => {
                            state.worlds.world.insert((&worldid).to_string(), o);
                        },
                        Err(e) => {
                            println!("Failed to perse World")
                        }
                    }
                    println!("Receive get_world_by_id {:?} time: {:?}", worldid, now.elapsed());
                    return Ok(res_text);
                },
                _ => {
                    println!("Receive Error get_world_by_id {:?} time: {:?}", worldid, now.elapsed());
                    return Err("Failed...".into());
                },
            };
        }
    }
}

#[tauri::command]
#[specta::specta]
async fn get_raw_world_by_id(worldid: &str) -> Result<String, RustError> {
    let client = CLIENT.lock().await;

    let res = client.get(format!("https://api.vrchat.cloud/api/1/worlds/{worldid}"))
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => {
            let res_text = res.error_for_status()?.text().await.map_err(|e| e.to_string())?;
            return Ok(res_text);
        },
        _ => {
            return Err("Failed...".into());
        },
    };
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
    let mut builder = Builder::<tauri::Wry>::new()
        // Then register them (separated by a comma)
        .commands(collect_commands![login, emailOtp, twoFactorAuth, verifyAuthToken, cookieClear, get_current_user_info, get_current_user_friends, get_world_by_id, get_raw_world_by_id]);

    #[cfg(debug_assertions)] // <- Only export on non-release builds
    builder
        .export(Typescript::default(), "../src/bindings.ts")
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            app.manage(Mutex::new(AppState::default()));
            builder.mount_events(app);
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
