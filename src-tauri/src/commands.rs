use crate::structs::ApiResponse;
#[cfg(dev)]
use crate::structs::{AppState, Favorite, User, World};
#[cfg(dev)]
use crate::{load_cookies, save_cookies, CLIENT, COOKIE_STORE};
use log::debug;
#[cfg(dev)]
use log::{error, trace};
#[cfg(dev)]
use once_cell::sync::Lazy;
#[cfg(dev)]
use reqwest::Response;
use serde::Serialize;
#[cfg(dev)]
use serde::Deserialize;
#[cfg(dev)]
use serde_json::json;
use std::fmt::Display;
#[cfg(dev)]
use std::sync::Arc;
#[cfg(dev)]
use std::time;
use tauri::ipc::Invoke;
use tauri::path::BaseDirectory;
use tauri::{generate_handler, Manager};
#[cfg(dev)]
use tokio::sync::RwLock;

#[cfg(dev)]
const VRCHAT_API_BASE_URL: &str = "https://api.vrchat.cloud/api";

pub(crate) fn handlers() -> impl Fn(Invoke) -> bool + Send + Sync + 'static {
    generate_handler![
        #[cfg(desktop)]
        crate::beta_updates::check_beta_update,
        crate::preferences::settings_get,
        crate::preferences::settings_set,
        crate::social::social_switch,
        crate::social::social_login,
        crate::social::social_otp,
        crate::social::social_cancel,
        crate::social::social_logout,
        crate::social::social_request,
        get_licenses,
        get_release_note,
        #[cfg(all(dev, debug_assertions))]
        debug_api_request,
        #[cfg(all(dev, debug_assertions))]
        get_current_user_friends,
        #[cfg(all(dev, debug_assertions))]
        get_current_user_info,
        #[cfg(all(dev, debug_assertions))]
        get_raw_world_by_id,
        #[cfg(all(dev, debug_assertions))]
        get_instance,
        #[cfg(all(dev, debug_assertions))]
        get_favorites_user_instances,
    ]
}

#[cfg(all(dev, not(any(target_os = "android", target_os = "ios"))))]
pub(crate) fn export_ts() {
    tauri_specta::Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            crate::beta_updates::check_beta_update,
            crate::preferences::settings_get,
            crate::preferences::settings_set,
            crate::social::social_switch,
            crate::social::social_login,
            crate::social::social_otp,
            crate::social::social_cancel,
            crate::social::social_logout,
            crate::social::social_request,
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
            get_user_profile_by_id,
            invite_myself_to_instance,
            get_licenses,
            debug_api_request,
            get_group_by_id,
            get_user_group_instances,
            switch_user,
            get_release_note,
            get_favorites_user_instances,
        ])
        .export(
            specta_typescript::Typescript::default()
                .bigint(specta_typescript::BigIntExportBehavior::Number),
            "../src/bindings.ts",
        )
        .unwrap();
}

#[cfg(dev)]
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
                error!("VRChat API HTTP {}", $res.status());
                Err($res.status().into())
            },
        }
    }};
}

#[cfg(dev)]
static APP_STATE: Lazy<Arc<RwLock<AppState>>> =
    Lazy::new(|| Arc::new(RwLock::new(AppState::default())));

#[cfg(dev)]
pub async fn insert_world(world_id: String, world: World) {
    let mut state = APP_STATE.write().await;
    state.worlds.world.insert(world_id, world);
}

#[cfg(dev)]
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
        RustError::unrecoverable(value.to_string())
    }
}

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
async fn cookie_clear(_app_handle: tauri::AppHandle) {
    debug!("Call cookie_clear");
    
    let cookie_store = COOKIE_STORE.clone();
    cookie_store.lock().unwrap().clear();
}

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
fn switch_user(app_handle: tauri::AppHandle, user_id: &str) {
    debug!("登録済みアカウントの切り替え");

    let _ = load_cookies(&app_handle, user_id);
}

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
async fn login(
    _app_handle: tauri::AppHandle,
    user_name: &str,
    password: &str,
) -> Result<String, RustError> {
    debug!("Call login");

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
            error!("VRChat API HTTP {}", res.status());
            Err("errors.loginFail".into())
        },
        _ => {
            error!("VRChat API HTTP {}", res.status());
            Err(res.status().into())
        },
    }
}

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
async fn email_otp(app_handle: tauri::AppHandle, otp: &str) -> Result<bool, RustError> {
    debug!("Call email_otp");

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

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
async fn two_factor_auth(app_handle: tauri::AppHandle, otp: &str) -> Result<bool, RustError> {
    debug!("Call two_factor_auth");

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

#[cfg(dev)]
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
                            error!("VRChat API HTTP {}", res.status());
                            return Err("errors.2faFail".into());
                        }
                    }
                }
            }
            Ok(false)
        }
        reqwest::StatusCode::UNAUTHORIZED => {
            error!("VRChat API HTTP {}", r.status());
            Err("errors.2faFail".into())
        },
        reqwest::StatusCode::BAD_REQUEST => {
            error!("VRChat API HTTP {}", r.status());
            Err("errors.2faFail".into())
        },
        _ => {
            error!("VRChat API HTTP {}", r.status());
            Err(r.status().into())
        },
    }
}

#[cfg(dev)]
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
            error!("VRChat API HTTP {}", res.status());
            Err("errors.unauthorized".into())
        },
        _ => {
            error!("VRChat API HTTP {}", res.status());
            Err(res.status().into())
        },
    }
}

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
async fn get_current_user_info() -> Result<String, RustError> {
    debug!("Call get_current_user_info");

    let res = get_current_user_info_inner().await;

    handle_raw_response!(res)
}

#[cfg(dev)]
async fn get_current_user_info_inner() -> Response {
    let client = CLIENT.clone();

    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/auth/user"))
        .send()
        .await.unwrap();

    res
}

#[cfg(dev)]
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

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
async fn get_user_by_id(user_id: &str) -> Result<String, RustError> {
    debug!("Call get_user_by_id");

    let clinet = CLIENT.clone();

    let res = clinet
        .get(format!("{VRCHAT_API_BASE_URL}/1/users/{user_id}"))
        .send()
        .await?;

    handle_raw_response!(res)
}

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
async fn get_user_profile_by_id(user_id: &str) -> Result<String, RustError> {
    debug!("Call get_user_profile_by_id");

    let client = CLIENT.clone();

    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/profile/{user_id}"))
        .send()
        .await?;

    handle_raw_response!(res)
}

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
async fn get_group_by_id(group_id: &str) -> Result<String, RustError> {
    debug!("Call get_group_by_id");

    let clinet = CLIENT.clone();

    let res = clinet
        .get(format!("{VRCHAT_API_BASE_URL}/1/groups/{group_id}"))
        .send()
        .await?;

    handle_raw_response!(res)
}

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
async fn get_world_by_id(worldid: &str) -> Result<String, RustError> {
    debug!("Call get_world_by_id");

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
            trace!("cached get_world_by_id {:?}", now.elapsed());
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
                            error!("ワールド情報を読み取れませんでした");
                        }
                    }
                    trace!("get_world_by_id {:?}", now.elapsed());
                    Ok(res_text)
                }
                _ => {
                    error!("Error get_world_by_id {:?}", now.elapsed());
                    Err("Failed...".into())
                }
            }
        }
    }
}

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
async fn get_raw_world_by_id(worldid: &str) -> Result<String, RustError> {
    debug!("Call get_raw_world_by_id");

    let client = CLIENT.clone();

    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/worlds/{worldid}"))
        .send()
        .await?;

    handle_raw_response!(res)
}

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
async fn get_instance(worldid: &str, instanceid: &str) -> Result<String, RustError> {
    debug!("Call get_instance");

    let client = CLIENT.clone();

    let res = client
        .get(format!(
            "{VRCHAT_API_BASE_URL}/1/instances/{worldid}:{instanceid}"
        ))
        .send()
        .await?;

    handle_raw_response!(res)
}

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
async fn invite_myself_to_instance(world_id: &str, instance_id: &str) -> Result<bool, RustError> {
    debug!("Call invite_myself_to_instance");

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
            error!("VRChat API HTTP {}", res.status());
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
    debug!("Call get_release_note");
    let client = reqwest::Client::builder().user_agent(crate::USER_AGENT).build()?;

    let res = client
        .get(format!(
            "https://api.github.com/repos/meronmks/vrc-social-manager/releases/tags/v{tag_name}"
        ))
        .send()
        .await?;

    Ok(res.error_for_status()?.text().await?)
}

#[cfg(dev)]
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[specta(export)]
pub struct DebugApiRequest {
    pub method: String,
    pub endpoint: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<String>,
}

#[cfg(dev)]
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

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
async fn get_user_group_instances() -> Result<String, RustError> {
    debug!("Call get_user_group_instances");

    // 現在のユーザー情報を取得してIDを抽出
    let current_user_res = get_current_user_info_inner().await;
    
    match current_user_res.status() {
        reqwest::StatusCode::OK => {
            let user_text = current_user_res.error_for_status()?.text().await?;
            let user_json: serde_json::Value = serde_json::from_str(&user_text)
                .map_err(|e| format!("Failed to parse user info: {}", e))?;
            
            let user_id = user_json["id"].as_str()
                .ok_or("User ID not found in response")?;
            
            // ユーザーのグループインスタンスを取得
            let client = CLIENT.clone();
            let res = client
                .get(format!("{VRCHAT_API_BASE_URL}/1/users/{user_id}/instances/groups"))
                .send()
                .await?;
            
            handle_raw_response!(res)
        }
        reqwest::StatusCode::UNAUTHORIZED => {
            error!("Unauthorized access when getting user group instances");
            Err("errors.unauthorized".into())
        }
        _ => {
            error!("VRChat API HTTP {}", current_user_res.status());
            Err(current_user_res.status().into())
        }
    }
}

#[cfg(dev)]
#[tauri::command]
#[specta::specta]
async fn get_favorites_user_instances(offset: i32, n: i32) -> Result<String, RustError> {
    debug!("Call get_favorites_user_instances");

    let client = CLIENT.clone();
    // ユーザーのお気に入りフレンドを取得
    let res = client
        .get(format!("{VRCHAT_API_BASE_URL}/1/favorites"))
        .query(&[("offset", offset), ("n", n)])
        .query(&[("type", "friend")])
        .send()
        .await?;

    match res.status() {
        reqwest::StatusCode::OK => {
            let res_text = res
                .error_for_status()?
                .text()
                .await
                .map_err(|e| e.to_string())?;
            let favorites: Vec<Favorite> = serde_json::from_str(&res_text)?;
            let mut users: Vec<User> = Vec::new();

            for favorite in &favorites {
                let res2 = get_user_by_id(&favorite.favorite_id).await?;
                users.push(serde_json::from_str(&res2)?);
            }

            Ok(serde_json::to_string(&users)?)
        }
        reqwest::StatusCode::UNAUTHORIZED => {
            error!("Unauthorized access when getting favorites");
            Err("errors.unauthorized".into())
        }
        _ => {
            error!("VRChat API HTTP {}", res.status());
            Err(res.status().into())
        }
    }
}
