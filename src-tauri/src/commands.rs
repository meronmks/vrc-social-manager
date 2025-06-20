use crate::structs::{ApiResponse, AppState, World};
use crate::{load_cookies, save_cookies, CLIENT, COOKIE_STORE};
use log::{debug, error, trace};
use once_cell::sync::Lazy;
use reqwest::Response;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fmt::Display;
use std::sync::Arc;
use std::time;
use tauri::ipc::Invoke;
use tauri::path::BaseDirectory;
use tauri::{generate_handler, Manager};
use tokio::sync::RwLock;

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
        debug_api_request,
        get_group_by_id,
        switch_user,
        get_release_note,
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
            debug_api_request,
            get_group_by_id,
            switch_user,
            get_release_note,
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
            _ => {
                error!("Failed to get response {:?}", $res);
                Err($res.status().into())
            },
        }
    }};
}

static APP_STATE: Lazy<Arc<RwLock<AppState>>> =
    Lazy::new(|| Arc::new(RwLock::new(AppState::default())));

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
pub enum RustError {
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
async fn cookie_clear(_app_handle: tauri::AppHandle) {
    debug!("Call cookie_clear");
    
    let cookie_store = COOKIE_STORE.clone();
    cookie_store.lock().unwrap().clear();
}

#[tauri::command]
#[specta::specta]
fn switch_user(app_handle: tauri::AppHandle, user_id: &str) {
    debug!("Switch user to {:?}", user_id);

    let _ = load_cookies(&app_handle, user_id);
}

#[tauri::command]
#[specta::specta]
async fn login(
    _app_handle: tauri::AppHandle,
    user_name: &str,
    password: &str,
) -> Result<String, RustError> {
    debug!("Call login {:?} {:?}", user_name, password);

    let client = CLIENT.clone();

    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/auth/user"))
        .basic_auth(user_name, Some(password))
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => {
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
            error!("Login failed: {:?}", res);
            Err("errors.loginFail".into())
        },
        _ => {
            error!("Login failed: {:?}", res);
            Err(res.status().into())
        },
    }
}

#[tauri::command]
#[specta::specta]
async fn email_otp(app_handle: tauri::AppHandle, otp: &str) -> Result<bool, RustError> {
    debug!("Call email_otp {:?}", otp);

    let client = CLIENT.clone();

    let res = client
        .post(format!(
            "{VRCHAT_API_BASE_URL}/1/auth/twofactorauth/emailotp/verify"
        ))
        .json(&json!({"code": otp}))
        .send()
        .await?;

    otp_verified_check(app_handle, res).await
}

#[tauri::command]
#[specta::specta]
async fn two_factor_auth(app_handle: tauri::AppHandle, otp: &str) -> Result<bool, RustError> {
    debug!("Call two_factor_auth {:?}", otp);

    let client = CLIENT.clone();

    let res = client
        .post(format!(
            "{VRCHAT_API_BASE_URL}/1/auth/twofactorauth/totp/verify"
        ))
        .json(&json!({"code": otp}))
        .send()
        .await?;

    otp_verified_check(app_handle, res).await
}

async fn otp_verified_check(app_handle: tauri::AppHandle, r: Response) -> Result<bool, RustError> {
    match r.status() {
        reqwest::StatusCode::OK => {
            let res_text = r.error_for_status()?.text().await?;
            let res_json: serde_json::Value = serde_json::from_str(&res_text).unwrap();
            if res_json["verified"].is_boolean() {
                if res_json["verified"].as_bool().unwrap() {
                    let res = get_current_user_info_inner().await;
                    match res.status() {
                        reqwest::StatusCode::OK => {
                            let rt = res.error_for_status()?.text().await?;
                            let rj: serde_json::Value = serde_json::from_str(&rt).unwrap();
                            save_cookies(&app_handle, rj["id"].as_str().unwrap()).await?;
                            return Ok(true);
                        },
                        _ => {
                            error!("Failed to get current user info after 2FA: {:?}", res);
                            return Err("errors.2faFail".into());
                        }
                    }
                }
            }
            Ok(false)
        }
        reqwest::StatusCode::UNAUTHORIZED => {
            error!("2FA failed: {:?}", r);
            Err("errors.2faFail".into())
        },
        reqwest::StatusCode::BAD_REQUEST => {
            error!("2FA failed: {:?}", r);
            Err("errors.2faFail".into())
        },
        _ => {
            error!("2FA failed: {:?}", r);
            Err(r.status().into())
        },
    }
}

#[tauri::command]
#[specta::specta]
async fn verify_auth_token() -> Result<bool, RustError> {
    debug!("Call verify_auth_token");

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
            error!("Verify auth token failed: {:?}", res);
            Err("errors.unauthorized".into())
        },
        _ => {
            error!("Verify auth token failed: {:?}", res);
            Err(res.status().into())
        },
    }
}

#[tauri::command]
#[specta::specta]
async fn get_current_user_info() -> Result<String, RustError> {
    debug!("Call get_current_user_info");

    let res = get_current_user_info_inner().await;

    handle_raw_response!(res)
}

async fn get_current_user_info_inner() -> Response {
    let client = CLIENT.clone();

    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/auth/user"))
        .send()
        .await.unwrap();

    res
}

#[tauri::command]
#[specta::specta]
async fn get_current_user_friends(offset: i32, n: i32, offline: bool) -> Result<String, RustError> {
    debug!(
        "Call get_current_user_friends {:?} {:?} {:?}",
        offset, n, offline
    );

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
    debug!("Call get_user_by_id {:?}", user_id);

    let clinet = CLIENT.clone();

    let res = clinet
        .get(format!("{VRCHAT_API_BASE_URL}/1/users/{user_id}"))
        .send()
        .await?;

    handle_raw_response!(res)
}

#[tauri::command]
#[specta::specta]
async fn get_group_by_id(group_id: &str) -> Result<String, RustError> {
    debug!("Call get_group_by_id {:?}", group_id);

    let clinet = CLIENT.clone();

    let res = clinet
        .get(format!("{VRCHAT_API_BASE_URL}/1/groups/{group_id}"))
        .send()
        .await?;

    handle_raw_response!(res)
}

#[tauri::command]
#[specta::specta]
async fn get_world_by_id(worldid: &str) -> Result<String, RustError> {
    debug!("Call get_world_by_id {:?}", worldid);

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
            thumbnailImageUrl: "https://assets.vrchat.com/www/images/user-location-offline.png"
                .to_string(),
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
            trace!(
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
                            error!("Failed to parse World {:?}", _e);
                        }
                    }
                    trace!(
                        "Receive get_world_by_id {:?} time: {:?}",
                        worldid,
                        now.elapsed()
                    );
                    Ok(res_text)
                }
                _ => {
                    error!(
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
    debug!("Call get_raw_world_by_id {:?}", worldid);

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
    debug!(
        "Call get_instance {:?} {:?}",
        worldid, instanceid
    );

    let client = CLIENT.clone();

    let res = client
        .get(format!(
            "{VRCHAT_API_BASE_URL}/1/instances/{worldid}:{instanceid}"
        ))
        .send()
        .await?;

    handle_raw_response!(res)
}

#[tauri::command]
#[specta::specta]
async fn invite_myself_to_instance(world_id: &str, instance_id: &str) -> Result<bool, RustError> {
    debug!(
        "Call invite_myself_to_instance {:?} {:?}",
        world_id, instance_id
    );

    let client = CLIENT.clone();

    let res = client
        .post(format!(
            "{VRCHAT_API_BASE_URL}/1/invite/myself/to/{world_id}:{instance_id}"
        ))
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => Ok(true),
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

#[tauri::command]
#[specta::specta]
pub async fn get_release_note(tag_name: &str) -> Result<String, RustError> {
    debug!("Call get_release_note {:?}", tag_name);
    let client = CLIENT.clone();

    let res = client
        .get(format!(
            "https://api.github.com/repos/meronmks/vrc-social-manager/releases/tags/v{tag_name}"
        ))
        .send()
        .await?;

    handle_raw_response!(res)
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[specta(export)]
pub struct DebugApiRequest {
    pub method: String,
    pub endpoint: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<String>,
}

#[tauri::command]
#[specta::specta]
async fn debug_api_request(request: DebugApiRequest) -> Result<ApiResponse, RustError> {
    let client = CLIENT.clone();

    let mut req = match request.method.to_uppercase().as_str() {
        "GET" => client.get(format!("{VRCHAT_API_BASE_URL}{}", request.endpoint)),
        "POST" => client.post(format!("{VRCHAT_API_BASE_URL}{}", request.endpoint)),
        "PUT" => client.put(format!("{VRCHAT_API_BASE_URL}{}", request.endpoint)),
        "DELETE" => client.delete(format!("{VRCHAT_API_BASE_URL}{}", request.endpoint)),
        "PATCH" => client.patch(format!("{VRCHAT_API_BASE_URL}{}", request.endpoint)),
        _ => return Err("Unsupported HTTP method".into()),
    };

    if let Some(data) = request.data {
        // Parse the JSON string to ensure it's valid
        let json_data: serde_json::Value =
            serde_json::from_str(&data).map_err(|e| format!("Invalid JSON data: {}", e))?;
        req = req.json(&json_data);
    }

    let res = req.send().await?;
    match res.status() {
        reqwest::StatusCode::OK => {
            let res_text = res
                .error_for_status()?
                .text()
                .await
                .map_err(|e| e.to_string())?;
            Ok(ApiResponse {
                status: "ok".to_string(),
                data: res_text,
            })
        }
        _ => Ok(ApiResponse {
            status: "error".to_string(),
            data: format!("Request failed with status: {}", res.status()),
        }),
    }
}
