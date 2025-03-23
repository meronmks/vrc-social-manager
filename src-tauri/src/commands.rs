use crate::structs::{AppState, World};
use crate::{save_cookies, CLIENT, COOKIE_STORE};
use reqwest::Response;
use serde::Serialize;
use serde_json::json;
use std::fmt::Display;
use std::time;
use tauri::ipc::Invoke;
use tauri::{generate_handler, State};
use tokio::sync::Mutex;

const VRCHAT_API_BASE_URL: &str = "https://api.vrchat.cloud/api";

pub(crate) fn handlers() -> impl Fn(Invoke) -> bool + Send + Sync + 'static {
    generate_handler![
        login,
        email_otp,
        two_factor_auth,
        verify_auth_token,
        cookie_clear,
        get_current_user_info,
        get_current_user_friends,
        get_world_by_id,
        get_raw_world_by_id,
    ]
}

#[cfg(debug_assertions)]
pub(crate) fn export_ts() {
    tauri_specta::Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            login,
            email_otp,
            two_factor_auth,
            verify_auth_token,
            cookie_clear,
            get_current_user_info,
            get_current_user_friends,
            get_world_by_id,
            get_raw_world_by_id,
        ])
        .export(
            specta_typescript::Typescript::default()
                .bigint(specta_typescript::BigIntExportBehavior::Number),
            "../src/bindings.ts",
        )
        .unwrap();
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
async fn cookie_clear() {
    let cookie_store = COOKIE_STORE.clone();
    cookie_store.lock().unwrap().clear();
    let _ = save_cookies().await;
}

#[tauri::command]
#[specta::specta]
async fn login(user_name: &str, password: &str) -> Result<String, RustError> {
    let client = CLIENT.lock().await;

    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/auth/user"))
        .basic_auth(user_name, Some(password))
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => {
            save_cookies().await?;
            let res_text = res.error_for_status()?.text().await?;
            let res_json: serde_json::Value = serde_json::from_str(&res_text).unwrap();
            if res_json["requiresTwoFactorAuth"].is_array() {
                if res_json["requiresTwoFactorAuth"]
                    .as_array()
                    .unwrap()
                    .contains(&json!("emailOtp"))
                {
                    Ok("emailOtp".to_string())
                } else {
                    Ok("totp".to_string())
                }
            } else {
                Ok(res_text)
            }
        }
        _ => Err("Login Failed...".into()),
    }
}

#[tauri::command]
#[specta::specta]
async fn email_otp(otp: &str) -> Result<bool, RustError> {
    let client = CLIENT.lock().await;

    let res = client
        .post(format!(
            "{VRCHAT_API_BASE_URL}/1/auth/twofactorauth/emailotp/verify"
        ))
        .json(&json!({"code": otp}))
        .send()
        .await?;

    otp_verified_check(res).await
}

#[tauri::command]
#[specta::specta]
async fn two_factor_auth(otp: &str) -> Result<bool, RustError> {
    let client = CLIENT.lock().await;

    let res = client
        .post(format!(
            "{VRCHAT_API_BASE_URL}/1/auth/twofactorauth/totp/verify"
        ))
        .json(&json!({"code": otp}))
        .send()
        .await?;

    otp_verified_check(res).await
}

async fn otp_verified_check(r: Response) -> Result<bool, RustError> {
    match r.status() {
        reqwest::StatusCode::OK => {
            let res_text = r.error_for_status()?.text().await?;
            let res_json: serde_json::Value = serde_json::from_str(&res_text).unwrap();
            if res_json["verified"].is_boolean() {
                if res_json["verified"].as_bool().unwrap() {
                    save_cookies().await?;
                    return Ok(true);
                }
            }
            Ok(false)
        }
        _ => Err("Login Failed...".into()),
    }
}

#[tauri::command]
#[specta::specta]
async fn verify_auth_token(state: State<'_, Mutex<AppState>>) -> Result<bool, RustError> {
    let client = CLIENT.lock().await;

    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/auth"))
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
            Ok(false)
        }
        _ => Err("Login Failed...".into()),
    }
}

#[tauri::command]
#[specta::specta]
async fn get_current_user_info() -> Result<String, RustError> {
    let client = CLIENT.lock().await;

    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/auth/user"))
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => {
            let res_text = res
                .error_for_status()?
                .text()
                .await
                .map_err(|e| e.to_string())?;
            Ok(res_text)
        }
        _ => Err("Failed...".into()),
    }
}

#[tauri::command]
#[specta::specta]
async fn get_current_user_friends(offset: i32, n: i32, offline: bool) -> Result<String, RustError> {
    let client = CLIENT.lock().await;

    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/auth/user/friends"))
        .query(&[("offset", offset), ("n", n)])
        .query(&[("offline", offline)])
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => {
            let res_text = res
                .error_for_status()?
                .text()
                .await
                .map_err(|e| e.to_string())?;
            Ok(res_text)
        }
        _ => Err("Failed...".into()),
    }
}

#[tauri::command]
#[specta::specta]
async fn get_world_by_id(
    state: State<'_, Mutex<AppState>>,
    worldid: &str,
) -> Result<String, RustError> {
    if worldid == "private" {
        let w = World {
            id: "private".to_string(),
            name: "In a private world".to_string(),
            thumbnailImageUrl:
                "https://assets.vrchat.com/www/images/user-location-private-world.png".to_string(),
        };
        return Ok(serde_json::to_string(&w).unwrap());
    } else if worldid == "offline" {
        let w = World {
            id: "offline".to_string(),
            name: "On Web or Mobile".to_string(),
            thumbnailImageUrl:
                "https://assets.vrchat.com/www/images/user-location-private-world.png".to_string(),
        };
        return Ok(serde_json::to_string(&w).unwrap());
    } else if worldid == "traveling" {
        let w = World {
            id: "traveling".to_string(),
            name: "In a traveling world".to_string(),
            thumbnailImageUrl:
                "https://assets.vrchat.com/www/images/user-location-private-world.png".to_string(),
        };
        return Ok(serde_json::to_string(&w).unwrap());
    }

    #[cfg(debug_assertions)]
    println!("Call get_world_by_id {:?}", worldid);
    let now = time::Instant::now();

    let mut state = state.lock().await;

    let world = state.worlds.world.get(worldid);

    match world {
        Some(result) => {
            println!(
                "Receive cached get_world_by_id {:?} time: {:?}",
                worldid,
                now.elapsed()
            );
            return Ok(serde_json::to_string(&result).unwrap());
        }
        None => {
            let client = CLIENT.lock().await;

            let res = client
                .get(format!("{VRCHAT_API_BASE_URL}/1/worlds/{worldid}"))
                .send()
                .await?;

            match res.status() {
                reqwest::StatusCode::OK => {
                    let res_text = res
                        .error_for_status()?
                        .text()
                        .await
                        .map_err(|e| e.to_string())?;
                    let json = serde_json::from_str::<World>(&res_text);
                    match json {
                        Ok(o) => {
                            state.worlds.world.insert((&worldid).to_string(), o);
                        }
                        Err(_e) => {
                            println!("Failed to perse World")
                        }
                    }
                    #[cfg(debug_assertions)]
                    println!(
                        "Receive get_world_by_id {:?} time: {:?}",
                        worldid,
                        now.elapsed()
                    );
                    Ok(res_text)
                }
                _ => {
                    #[cfg(debug_assertions)]
                    println!(
                        "Receive Error get_world_by_id {:?} time: {:?}",
                        worldid,
                        now.elapsed()
                    );
                    Err("Failed...".into())
                }
            }
        }
    }
}

#[tauri::command]
#[specta::specta]
async fn get_raw_world_by_id(worldid: &str) -> Result<String, RustError> {
    let client = CLIENT.lock().await;

    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/worlds/{worldid}"))
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => {
            let res_text = res
                .error_for_status()?
                .text()
                .await
                .map_err(|e| e.to_string())?;
            Ok(res_text)
        }
        _ => Err("Failed...".into()),
    }
}
