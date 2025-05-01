use crate::structs::{AppState, World, ApiResponse};
use crate::{save_cookies, CLIENT, COOKIE_STORE};
use reqwest::Response;
use serde::Serialize;
use serde_json::json;
use tauri::path::BaseDirectory;
use std::fmt::Display;
use std::sync::Arc;
use std::time;
use once_cell::sync::Lazy;
use tauri::ipc::Invoke;
use tauri::{generate_handler, Manager};
use tokio::sync::RwLock;
use log::error;

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
        get_instance,
        get_user_by_id,
        invite_myself_to_instance,
        get_licenses,
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
            get_instance,
            get_user_by_id,
            invite_myself_to_instance,
            get_licenses,
        ])
        .export(
            specta_typescript::Typescript::default()
                .bigint(specta_typescript::BigIntExportBehavior::Number),
            "../src/bindings.ts",
        )
        .unwrap();
}

macro_rules! handle_raw_response {
    ($res:expr) => {{
        match $res.status() {
            reqwest::StatusCode::OK => {
                let res_text = $res
                    .error_for_status()?
                    .text()
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(res_text)
            }
            _ => Err($res.status().into()),
        }
    }};
}

static APP_STATE: Lazy<Arc<RwLock<AppState>>> = Lazy::new(|| Arc::new(RwLock::new(AppState::default())));

pub async fn insert_world(world_id: String, world: World) {
    let mut state = APP_STATE.write().await;
    state.worlds.world.insert(world_id, world);
}

pub async fn get_world(world_id: String) -> Option<World> {
    let state = APP_STATE.read().await;
    state.worlds.world.get(&world_id).cloned()
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
        error!("{value}");
        RustError::unrecoverable(value.to_string())
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
    let client = CLIENT.clone();

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
        reqwest::StatusCode::UNAUTHORIZED => {
            Err("errors.loginFail".into())
        }
        _ => Err(res.status().into()),
    }
}

#[tauri::command]
#[specta::specta]
async fn email_otp(otp: &str) -> Result<bool, RustError> {
    #[cfg(debug_assertions)]
    println!("Call email_otp {:?}", otp);

    let client = CLIENT.clone();

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
    #[cfg(debug_assertions)]
    println!("Call two_factor_auth {:?}", otp);

    let client = CLIENT.clone();

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
        reqwest::StatusCode::UNAUTHORIZED => {
            Err("errors.2faFail".into())
        }
        reqwest::StatusCode::BAD_REQUEST => {
            Err("errors.2faFail".into())
        }
        _ => Err(r.status().into()),
    }
}

#[tauri::command]
#[specta::specta]
async fn verify_auth_token() -> Result<bool, RustError> {
    let client = CLIENT.clone();

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
                    APP_STATE.write().await.is_login = true;
                    return Ok(true);
                }
            }
            Ok(false)
        }
        reqwest::StatusCode::UNAUTHORIZED => {
            Err("errors.unauthorized".into())
        }
        _ => Err(res.status().into()),
    }
}

#[tauri::command]
#[specta::specta]
async fn get_current_user_info() -> Result<String, RustError> {
    let client = CLIENT.clone();

    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/auth/user"))
        .send()
        .await?;

    handle_raw_response!(res)
}

#[tauri::command]
#[specta::specta]
async fn get_current_user_friends(offset: i32, n: i32, offline: bool) -> Result<String, RustError> {
    let client = CLIENT.clone();

    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/auth/user/friends"))
        .query(&[("offset", offset), ("n", n)])
        .query(&[("offline", offline)])
        .send()
        .await?;

    handle_raw_response!(res)
}

#[tauri::command]
#[specta::specta]
async fn get_user_by_id(user_id: &str) -> Result<String, RustError> {
    let clinet = CLIENT.clone();

    let res = clinet
        .get(format!("{VRCHAT_API_BASE_URL}/1/users/{user_id}"))
        .send()
        .await?;

    handle_raw_response!(res)
}

#[tauri::command]
#[specta::specta]
async fn get_world_by_id(
    worldid: &str,
) -> Result<String, RustError> {
    #[cfg(debug_assertions)]
    println!("Call get_world_by_id {:?}", worldid);

    if worldid == "private" {
        let w = World {
            id: "private".to_string(),
            name: "In a private world".to_string(),
            thumbnailImageUrl:
            "https://assets.vrchat.com/www/images/user-location-private-world.png".to_string(),
        };
        return Ok(serde_json::to_string(&w).unwrap());
    } else if worldid == "web_or_mobile" {
        let w = World {
            id: "web_or_mobile".to_string(),
            name: "On Web or Mobile".to_string(),
            thumbnailImageUrl:
            "https://assets.vrchat.com/www/images/user-location-private-world.png".to_string(),
        };
        return Ok(serde_json::to_string(&w).unwrap());
    } else if worldid == "offline" {
        let w = World {
            id: "offline".to_string(),
            name: "Offline".to_string(),
            thumbnailImageUrl:
                "https://assets.vrchat.com/www/images/user-location-offline.png".to_string(),
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
    let now = time::Instant::now();

    let world = get_world(worldid.to_string()).await;

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
            let client = CLIENT.clone();

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
                            insert_world((&worldid).to_string(), o).await;
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
    let client = CLIENT.clone();

    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/worlds/{worldid}"))
        .send()
        .await?;

    handle_raw_response!(res)
}

#[tauri::command]
#[specta::specta]
async fn get_instance(worldid: &str, instanceid: &str) -> Result<String, RustError> {
    let client = CLIENT.clone();

    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/instances/{worldid}:{instanceid}"))
        .send()
        .await?;

    handle_raw_response!(res)
}

#[tauri::command]
#[specta::specta]
async fn invite_myself_to_instance(world_id: &str, instance_id: &str) -> Result<bool, RustError> {
    #[cfg(debug_assertions)]
    println!("Call invite_myself_to_instance {:?} {:?}", world_id, instance_id);

    let client = CLIENT.clone();

    let res = client
        .post(format!(
            "{VRCHAT_API_BASE_URL}/1/invite/myself/to/{world_id}:{instance_id}"
        ))
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => {
            Ok(true)
        }
        _ => {
            error!("Failed to invite myself to instance {:?}", res,);
            Err(res.status().into())
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_licenses(app_handle: tauri::AppHandle) -> Result<ApiResponse, RustError> {
    let license_path = app_handle
        .path()
        .resolve("licenses.json", BaseDirectory::Resource)?;

    match std::fs::read_to_string(license_path) {
        Ok(content) => Ok(ApiResponse {
            status: "ok".to_string(),
            data: content,
        }),
        Err(e) => Ok(ApiResponse {
            status: "error".to_string(),
            data: format!("Failed to read licenses file: {}", e),
        }),
    }
}
