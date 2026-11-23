use crate::cache::{self, Kind};
use keyring::Entry;
use once_cell::sync::Lazy;
use reqwest::{Client, RequestBuilder, Url};
use reqwest_cookie_store::{CookieStore, CookieStoreMutex};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;

const API: &str = "https://api.vrchat.cloud/api/1";
type Outcome<T> = Result<T, String>;

#[derive(Clone)]
struct Session {
    client: Client,
    cookies: Arc<CookieStoreMutex>,
}

impl Session {
    fn new(jar: CookieStore) -> Outcome<Self> {
        let cookies = Arc::new(CookieStoreMutex::new(jar));
        let client = Client::builder()
            // 認証要求はリダイレクトしない。画像取得だけは配信先の HTTPS 転送を許可する。
            .redirect(reqwest::redirect::Policy::custom(|attempt| {
                let media = attempt.previous().first().is_some_and(|source| {
                    source.origin().ascii_serialization() == "https://api.vrchat.cloud"
                        && (source.path().starts_with("/api/1/file/")
                            || source.path().starts_with("/api/1/image/"))
                });
                if media && attempt.url().scheme() == "https" && attempt.previous().len() < 10 {
                    attempt.follow()
                } else {
                    attempt.stop()
                }
            }))
            .cookie_provider(cookies.clone())
            .user_agent(crate::USER_AGENT)
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|_| "network")?;
        Ok(Self { client, cookies })
    }
}

struct Challenge {
    session: Session,
    target: Option<String>,
    login_id: String,
    method: String,
    started: Instant,
}

static ACTIVE: Lazy<RwLock<Option<(String, Session)>>> = Lazy::new(|| RwLock::new(None));
static LOGIN: Lazy<Mutex<Option<Challenge>>> = Lazy::new(|| Mutex::new(None));

// VRChat API へのリクエストは、種類を問わずこの間隔以上あけて送信を始める。
const REQUEST_INTERVAL: Duration = Duration::from_millis(200);
// 429 を受けたときに再試行する最大回数。
const MAX_RETRIES: u32 = 3;
// Retry-After がない・読めないときの待機時間（再試行ごとに倍にする）。
const FALLBACK_RETRY_AFTER: Duration = Duration::from_secs(5);
// これより長い待機を求められたときは再試行せず、そのまま 429 を返す。
const MAX_RETRY_AFTER: Duration = Duration::from_secs(60);

// 次のリクエストを送信してよい時刻。全アカウント・全リクエストで共有する。
static NEXT_SLOT: Lazy<Mutex<tokio::time::Instant>> =
    Lazy::new(|| Mutex::new(tokio::time::Instant::now()));

// 送信枠を一つ予約し、その開始時刻を返す。
async fn reserve_slot() -> tokio::time::Instant {
    let mut next = NEXT_SLOT.lock().await;
    let start = (*next).max(tokio::time::Instant::now());
    *next = start + REQUEST_INTERVAL;
    start
}

// 429 を受けたとき、以降のすべてのリクエストの開始を指定時間だけ遅らせる。
async fn hold_off(wait: Duration) {
    let mut next = NEXT_SLOT.lock().await;
    *next = (*next).max(tokio::time::Instant::now() + wait);
}

// Retry-After の秒数指定を読む。HTTP 日付形式など読めない値は None。
fn parse_retry_after(value: &str) -> Option<Duration> {
    value.trim().parse::<u64>().ok().map(Duration::from_secs)
}

async fn response(mut req: RequestBuilder) -> Outcome<reqwest::Response> {
    let mut attempt = 0;
    loop {
        // 再試行に備えて送信前に複製しておく（本文が複製できない要求は再試行しない）。
        let retry = req.try_clone();
        tokio::time::sleep_until(reserve_slot().await).await;
        let res = req.send().await.map_err(|_| {
            log::warn!("VRChat API の応答を受信できませんでした");
            "network"
        })?;
        let status = res.status();
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS && attempt < MAX_RETRIES {
            let wait = res
                .headers()
                .get(reqwest::header::RETRY_AFTER)
                .and_then(|v| v.to_str().ok())
                .and_then(parse_retry_after)
                .unwrap_or(FALLBACK_RETRY_AFTER * 2u32.pow(attempt));
            if let (Some(next), true) = (retry, wait <= MAX_RETRY_AFTER) {
                attempt += 1;
                log::warn!(
                    "VRChat API HTTP 429: {} 秒待って再試行します（{attempt}/{MAX_RETRIES}）",
                    wait.as_secs_f32()
                );
                hold_off(wait).await;
                req = next;
                continue;
            }
        }
        if !status.is_success() {
            let status = status.as_u16();
            log::warn!("VRChat API HTTP {status}");
            return Err(format!("http:{status}"));
        }
        return Ok(res);
    }
}

async fn json_body(req: RequestBuilder) -> Outcome<Value> {
    response(req)
        .await?
        .json()
        .await
        .map_err(|_| "invalid".into())
}

fn entry(app: &tauri::AppHandle, id: &str) -> Outcome<Entry> {
    Entry::new(&app.config().identifier, id).map_err(|_| "storage".into())
}

fn registry(
    app: &tauri::AppHandle,
) -> Outcome<(Arc<tauri_plugin_store::Store<tauri::Wry>>, Vec<Value>)> {
    let store = app.store("store.json").map_err(|_| "storage")?;
    let users = match store.get("users") {
        None => Vec::new(),
        Some(Value::String(s)) => serde_json::from_str(&s).map_err(|_| "storage")?,
        _ => return Err("storage".into()),
    };
    Ok((store, users))
}

fn save_registry(
    store: &tauri_plugin_store::Store<tauri::Wry>,
    users: &[Value],
    current: Option<&str>,
) -> Outcome<()> {
    let old_users = store.get("users");
    let old_current = store.get("current-user-id");
    store.set("users", json!(users).to_string());
    if let Some(id) = current {
        store.set("current-user-id", id);
    } else {
        store.delete("current-user-id");
    }
    if store.save().is_err() {
        for (key, old) in [("users", old_users), ("current-user-id", old_current)] {
            if let Some(v) = old {
                store.set(key, v);
            } else {
                store.delete(key);
            }
        }
        return Err("storage".into());
    }
    Ok(())
}

fn activate(
    app: &tauri::AppHandle,
    session: Session,
    user: Value,
    target: Option<&str>,
    login_id: Option<&str>,
) -> Outcome<Value> {
    let id = user["id"].as_str().ok_or("invalid")?;
    if target.is_some_and(|t| t != id) {
        return Err("mismatch".into());
    }
    let name = user["displayName"].as_str().ok_or("invalid")?;
    let (store, mut users) = registry(app)?;
    let old = users.iter().find(|u| u["id"] == id);
    let legacy: Option<Value> = old
        .and_then(|u| u["userData"].as_str())
        .and_then(|s| serde_json::from_str(s).ok());
    let login = login_id
        .or_else(|| old.and_then(|u| u["loginId"].as_str()))
        .or_else(|| {
            let profile = legacy.as_ref().filter(|u| u["id"] == id)?;
            profile["username"]
                .as_str()
                .or_else(|| profile["email"].as_str())
        });
    let mut account = json!({"id": id, "displayName":name, "loginId":login,
        "lastLogin":SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64});
    for key in [
        "userIcon",
        "iconUrl",
        "profilePicOverrideThumbnail",
        "profilePicOverride",
        "currentAvatarThumbnailImageUrl",
        "imageUrl",
        "currentAvatarImageUrl",
    ] {
        if let Some(url) = user[key].as_str().filter(|url| url.starts_with("https://")) {
            account[key] = json!(url);
        }
    }
    let mut active = ACTIVE.write().map_err(|_| "storage")?;
    let jar = session.cookies.lock().map_err(|_| "storage")?.clone();
    let credential = entry(app, id)?;
    let previous = match credential.get_password() {
        Ok(value) => Some(value),
        Err(keyring::Error::NoEntry) => None,
        Err(_) => return Err("storage".into()),
    };
    credential
        .set_password(&serde_json::to_string(&jar).map_err(|_| "storage")?)
        .map_err(|_| "storage")?;
    users.retain(|u| u["id"] != id);
    users.insert(0, account.clone());
    if let Err(e) = save_registry(&store, &users, Some(id)) {
        let restored = match previous {
            Some(value) => credential.set_password(&value),
            None => credential.delete_credential(),
        };
        if restored.is_err() {
            log::error!("認証情報を元に戻せませんでした");
        }
        return Err(e);
    }
    #[cfg(all(dev, debug_assertions))]
    {
        *crate::COOKIE_STORE
            .lock()
            .unwrap_or_else(|e| e.into_inner()) = jar;
    }
    *active = Some((id.into(), session));
    crate::cache::reset(Some(id));
    if let Some(names) = user
        .get("friendGroupNames")
        .filter(|value| value.is_array())
    {
        account["friendGroupNames"] = names.clone();
    }
    Ok(account)
}

#[tauri::command]
#[specta::specta]
pub async fn social_switch(app: tauri::AppHandle, id: String) -> Result<Value, String> {
    let mut pending = LOGIN.lock().await;
    *pending = None;
    if !registry(&app)?.1.iter().any(|user| user["id"] == id) {
        return Err("inactive".into());
    }
    let cookie = entry(&app, &id)?.get_password().map_err(|e| {
        if matches!(e, keyring::Error::NoEntry) {
            "http:401"
        } else {
            "storage"
        }
    })?;
    let session = Session::new(serde_json::from_str(&cookie).map_err(|_| "http:401")?)?;
    let user = json_body(session.client.get(format!("{API}/auth/user"))).await?;
    if user["id"].as_str() != Some(id.as_str()) {
        return Err("http:401".into());
    }
    activate(&app, session, user, Some(&id), None)
}

#[tauri::command]
#[specta::specta]
pub async fn social_login(
    app: tauri::AppHandle,
    target: Option<String>,
    login_id: String,
    password: String,
) -> Result<Value, String> {
    let mut pending = LOGIN.lock().await;
    *pending = None;
    let session = Session::new(CookieStore::default())?;
    let encode = |s: &str| -> String {
        s.bytes()
            .map(|b| {
                if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) {
                    (b as char).to_string()
                } else {
                    format!("%{b:02X}")
                }
            })
            .collect()
    };
    let user = json_body(
        session
            .client
            .get(format!("{API}/auth/user"))
            .basic_auth(encode(&login_id), Some(encode(&password))),
    )
    .await?;
    if let Some(methods) = user["requiresTwoFactorAuth"].as_array() {
        let method = ["emailOtp", "totp"]
            .into_iter()
            .find(|m| methods.iter().any(|v| v == *m))
            .ok_or("unsupported")?
            .to_string();
        *pending = Some(Challenge {
            session,
            target,
            login_id,
            method: method.clone(),
            started: Instant::now(),
        });
        return Ok(json!({"method":method}));
    }
    activate(&app, session, user, target.as_deref(), Some(&login_id))
}

#[tauri::command]
#[specta::specta]
pub async fn social_otp(app: tauri::AppHandle, code: String) -> Result<Value, String> {
    let mut pending = LOGIN.lock().await;
    if pending
        .as_ref()
        .is_some_and(|c| c.started.elapsed() >= Duration::from_secs(600))
    {
        *pending = None;
    }
    let c = pending.as_ref().ok_or("expired")?;
    let method = c.method.to_ascii_lowercase();
    let result = json_body(
        c.session
            .client
            .post(format!("{API}/auth/twofactorauth/{method}/verify"))
            .json(&json!({"code":code})),
    )
    .await?;
    if result["verified"] != true {
        return Err("code".into());
    }
    let c = pending.take().ok_or("expired")?;
    let user = json_body(c.session.client.get(format!("{API}/auth/user"))).await?;
    activate(
        &app,
        c.session,
        user,
        c.target.as_deref(),
        Some(&c.login_id),
    )
}

#[tauri::command]
#[specta::specta]
pub async fn social_cancel() {
    *LOGIN.lock().await = None;
}

#[tauri::command]
#[specta::specta]
pub async fn social_logout(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut pending = LOGIN.lock().await;
    let (store, users) = registry(&app)?;
    if store.get("current-user-id") != Some(json!(id)) {
        return Err("mismatch".into());
    }
    let mut active = ACTIVE.write().map_err(|_| "storage")?;
    if !matches!(active.as_ref(), Some((active_id, _)) if active_id == &id) {
        return Err("mismatch".into());
    }
    let credential = entry(&app, &id)?;
    let remaining: Vec<_> = users.iter().filter(|u| u["id"] != id).cloned().collect();
    // 資格情報を先に消すと、途中で終了しても未登録のCookieが端末に残らない。
    let previous = match credential.get_password() {
        Ok(value) => Some(value),
        Err(keyring::Error::NoEntry) => None,
        Err(_) => return Err("storage".into()),
    };
    match credential.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {}
        Err(_) => return Err("storage".into()),
    }
    if let Err(error) = save_registry(&store, &remaining, None) {
        if previous
            .as_ref()
            .is_none_or(|cookie| credential.set_password(cookie).is_err())
        {
            // 復元できないセッションを終了時に再保存しない。
            *active = None;
            *pending = None;
            crate::cache::reset(None);
            #[cfg(all(dev, debug_assertions))]
            crate::COOKIE_STORE
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .clear();
        }
        return Err(error);
    }
    *pending = None;
    *active = None;
    crate::cache::reset(None);
    #[cfg(all(dev, debug_assertions))]
    crate::COOKIE_STORE
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clear();
    store.delete(format!("favorite-group-{id}"));
    store.delete(format!("show-all-friends-{id}"));
    Ok(())
}

#[derive(Serialize, Deserialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Resource {
    Friends { offset: u32, n: u32, offline: bool },
    Groups,
    Favorites { offset: u32 },
    MemberInstances,
    Friend { id: String },
    Profile { id: String },
    World { id: String },
    Group { id: String },
    Instance { location: String },
    Invite { location: String },
    InstanceCategories,
    InstanceVibes,
    /// ログイン中のユーザー自身（現在地つき）
    Me,
}

async fn read_icon(client: &Client, source: &str) -> Outcome<cache::Image> {
    let url = Url::parse(source).map_err(|_| "invalid")?;
    let path: Vec<_> = url.path().split('/').collect();
    let valid_path = matches!(path.as_slice(), ["", "api", "1", route, id, version, size]
        if id.strip_prefix("file_").is_some_and(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_hexdigit() || b == b'-'))
        && version.parse::<u32>().is_ok()
        && ((*route == "file" && *size == "file") || (*route == "image" && size.parse::<u32>().is_ok())));
    if url.origin().ascii_serialization() != "https://api.vrchat.cloud"
        || !valid_path
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("invalid".into());
    }
    let mut res = response(client.get(url)).await?;
    const LIMIT: usize = 4 * 1024 * 1024;
    let mut bytes = Vec::new();
    while let Some(chunk) = res.chunk().await.map_err(|_| "network")? {
        if bytes.len() + chunk.len() > LIMIT {
            return Err("invalid".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    // 配信元が汎用の Content-Type を返す画像も、形式を確認してから表示する。
    let mime = match bytes.as_slice() {
        [0x89, b'P', b'N', b'G', 13, 10, 26, 10, ..] => "image/png",
        [0xff, 0xd8, 0xff, ..] => "image/jpeg",
        [b'G', b'I', b'F', b'8', b'7' | b'9', b'a', ..] => "image/gif",
        [b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'E', b'B', b'P', ..] => "image/webp",
        _ => return Err("invalid".into()),
    };
    Ok(cache::Image { mime, bytes })
}

// 画像を返すカスタムプロトコルの名前。画面では `convertFileSrc("image", IMAGE_SCHEME)` で URL を作る。
pub const IMAGE_SCHEME: &str = "vrcimg";

// 指定アカウントが利用中ならそのセッションのクライアントを返す。
fn client_for(account: &str) -> Outcome<Client> {
    ACTIVE
        .read()
        .map_err(|_| "storage")?
        .as_ref()
        .filter(|(id, _)| id == account)
        .map(|(_, s)| s.client.clone())
        .ok_or_else(|| "inactive".into())
}

// クエリの account（利用中アカウント）と url（VRChat の画像 URL）から画像を返す。
async fn serve_image(query: &str) -> Outcome<cache::Image> {
    let params = Url::parse(&format!("http://localhost/?{query}")).map_err(|_| "invalid")?;
    let (mut account, mut source) = (None, None);
    for (key, value) in params.query_pairs() {
        match key.as_ref() {
            "account" => account = Some(value.into_owned()),
            "url" => source = Some(value.into_owned()),
            _ => {}
        }
    }
    let (Some(account), Some(source)) = (account, source) else {
        return Err("invalid".into());
    };
    let client = client_for(&account)?;
    // 画像 URL はファイルのバージョンごとに変わるため、同じ URL の中身は使い回せる。
    if let Some(hit) = cache::icon(&account, &source) {
        return Ok(hit);
    }
    let image = read_icon(&client, &source).await?;
    cache::put_icon(&account, &source, image.clone());
    Ok(image)
}

// エラー文字列を画像プロトコルの HTTP ステータスへ変える。失敗は `<img>` の onError で次の候補へ進む。
fn image_error_status(error: &str) -> tauri::http::StatusCode {
    use tauri::http::StatusCode;
    match error {
        "invalid" => StatusCode::BAD_REQUEST,
        "inactive" => StatusCode::FORBIDDEN,
        "storage" => StatusCode::INTERNAL_SERVER_ERROR,
        _ => error
            .strip_prefix("http:")
            .and_then(|code| code.parse::<u16>().ok())
            .and_then(|code| StatusCode::from_u16(code).ok())
            .unwrap_or(StatusCode::BAD_GATEWAY),
    }
}

// 画像用カスタムプロトコルの応答を作る。
// Cookie が必要な VRChat の画像をアカウントのセッションで取得し、`<img>` へバイト列のまま返す。
// IPC で base64 の文字列を受け渡さずに済み、同じ URL は WebView 側でも使い回される。
pub async fn image_response(
    request: tauri::http::Request<Vec<u8>>,
) -> tauri::http::Response<Vec<u8>> {
    use tauri::http::{header, Method, Response, StatusCode};
    let built = if request.method() != Method::GET {
        Response::builder()
            .status(StatusCode::METHOD_NOT_ALLOWED)
            .body(Vec::new())
    } else {
        match serve_image(request.uri().query().unwrap_or_default()).await {
            Ok(image) => Response::builder()
                .header(header::CONTENT_TYPE, image.mime)
                // 内容は URL ごとに変わらないが、アカウントの画像なので共有キャッシュには置かせない。
                .header(header::CACHE_CONTROL, "private, max-age=86400, immutable")
                .header("X-Content-Type-Options", "nosniff")
                .body(image.bytes),
            Err(error) => Response::builder()
                .status(image_error_status(&error))
                .body(Vec::new()),
        }
    };
    built.unwrap_or_else(|_| {
        let mut fallback = Response::new(Vec::new());
        *fallback.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
        fallback
    })
}

// キャッシュがあればそれを返し、なければ取得して保持する。
// 想定と異なる形の応答（一覧以外はオブジェクト、一覧は配列）は保持しない。
async fn cached(account: &str, kind: Kind, id: &str, req: RequestBuilder) -> Outcome<Value> {
    if let Some(hit) = cache::get(account, kind, id) {
        log::trace!("キャッシュ利用: {kind:?} {id}");
        return Ok(hit);
    }
    let value = json_body(req).await?;
    let expected = if kind == Kind::Catalog {
        value.is_array()
    } else {
        value.is_object()
    };
    if expected {
        cache::put(account, kind, id, value.clone());
    }
    Ok(value)
}

// ユーザー取得APIの応答には画面に不要な非公開項目が含まれる場合がある。
fn visible_person(mut value: Value) -> Outcome<Value> {
    let fields = value.as_object_mut().ok_or("invalid")?;
    fields.retain(|name, _| {
        matches!(
            name.as_str(),
            "id" | "displayName"
                | "status"
                | "statusDescription"
                | "state"
                | "location"
                | "worldId"
                | "instanceId"
                | "bio"
                | "bioLinks"
                | "userIcon"
                | "iconUrl"
                | "profilePicOverrideThumbnail"
                | "profilePicOverride"
                | "currentAvatarThumbnailImageUrl"
                | "imageUrl"
                | "currentAvatarImageUrl"
        )
    });
    Ok(value)
}

#[tauri::command]
#[specta::specta]
pub async fn social_request(account: String, resource: Resource) -> Result<Value, String> {
    // 送信開始時にアカウント専用のクライアントを確保する。
    let client = client_for(&account)?;
    let endpoint = |segments: &[&str]| -> Outcome<Url> {
        if segments
            .iter()
            .any(|v| v.is_empty() || *v == "." || *v == "..")
        {
            return Err("invalid".into());
        }
        let mut url = Url::parse(API).map_err(|_| "invalid")?;
        url.path_segments_mut()
            .map_err(|_| "invalid")?
            .extend(segments);
        Ok(url)
    };
    let req = match resource {
        Resource::Friends { offset, n, offline } => {
            let page = json_body(
                client
                    .get(endpoint(&["auth", "user", "friends"])?)
                    .query(&[("offset", offset), ("n", n.clamp(1, 100))])
                    .query(&[("offline", offline)]),
            )
            .await?;
            let Value::Array(rows) = page else {
                return Err("invalid".into());
            };
            return rows
                .into_iter()
                .map(visible_person)
                .collect::<Outcome<Vec<_>>>()
                .map(Value::Array);
        }
        Resource::Groups => client
            .get(endpoint(&["favorite", "groups"])?)
            .query(&[("ownerId", account.as_str()), ("type", "friend"), ("n", "100")]),
        Resource::Favorites { offset } => client
            .get(endpoint(&["favorites"])?)
            .query(&[("type", "friend")])
            .query(&[("offset", offset), ("n", 100)]),
        Resource::MemberInstances => {
            let result =
                json_body(client.get(endpoint(&["users", &account, "instances", "groups"])?))
                    .await?;
            if let Some(instances) = result["instances"].as_array() {
                instances
                    .iter()
                    .for_each(|instance| cache::put_embedded_world(&account, instance));
            }
            return Ok(result);
        }
        Resource::Friend { id } => {
            return visible_person(json_body(client.get(endpoint(&["users", &id])?)).await?)
        }
        Resource::Profile { id } => {
            return visible_person(json_body(client.get(endpoint(&["profile", &id])?)).await?)
        }
        Resource::World { id } => {
            let req = client.get(endpoint(&["worlds", &id])?);
            return cached(&account, Kind::World, &id, req).await;
        }
        Resource::Group { id } => {
            let req = client.get(endpoint(&["groups", &id])?);
            return cached(&account, Kind::Group, &id, req).await;
        }
        Resource::Instance { location } => {
            let instance = json_body(client.get(endpoint(&["instances", &location])?)).await?;
            return if instance.is_object() {
                cache::put_embedded_world(&account, &instance);
                Ok(instance)
            } else {
                Err("invalid".into())
            };
        }
        // 自分自身の情報。現在地は `location` ではなく `presence` に入っているため、フレンドと同じ形に直す。
        Resource::Me => {
            let user = json_body(client.get(endpoint(&["auth", "user"])?)).await?;
            let presence = user["presence"].clone();
            let mut me = visible_person(user)?;
            let world = presence["world"].as_str().unwrap_or_default();
            let instance = presence["instance"].as_str().unwrap_or_default();
            if world.starts_with("wrld_") && !instance.is_empty() {
                me["location"] = json!(format!("{world}:{instance}"));
                me["worldId"] = json!(world);
                me["instanceId"] = json!(instance);
            } else if !world.is_empty() {
                // "offline"・"private"・"traveling" などはそのまま現在地として扱う
                me["location"] = json!(world);
            }
            return Ok(me);
        }
        Resource::Invite { location } => {
            response(client.post(endpoint(&["invite", "myself", "to", &location])?)).await?;
            return Ok(Value::Bool(true));
        }
        // インスタンスの categoryId・vibeIds を表示名に変えるための一覧。内容はほとんど変わらないため保持する。
        Resource::InstanceCategories => {
            let req = client.get(endpoint(&["instanceCategories"])?);
            return cached(&account, Kind::Catalog, "instanceCategories", req).await;
        }
        Resource::InstanceVibes => {
            let req = client.get(endpoint(&["instanceVibes"])?);
            return cached(&account, Kind::Catalog, "instanceVibes", req).await;
        }
    };
    json_body(req).await
}

pub fn save_active(app: &tauri::AppHandle) {
    if let Ok(active) = ACTIVE.read() {
        if let Some((id, session)) = active.as_ref() {
            let result = (|| -> Outcome<()> {
                let jar = session.cookies.lock().map_err(|_| "storage")?;
                let value = serde_json::to_string(&*jar).map_err(|_| "storage")?;
                entry(app, id)?
                    .set_password(&value)
                    .map_err(|_| "storage".into())
            })();
            if result.is_err() {
                log::error!("認証情報を保存できませんでした");
            }
        }
    }
}

#[cfg(test)]
mod security_tests {
    use super::*;

    #[test]
    fn only_display_fields_reach_the_person_view() {
        let person = json!({"id":"usr_demo","bio":"demo","location":"private","email":"demo@example.invalid","authToken":"fixture","futureField":true});
        assert_eq!(
            visible_person(person).unwrap(),
            json!({"id":"usr_demo","bio":"demo","location":"private"})
        );
        assert!(visible_person(Value::Null).is_err());
    }
}

#[cfg(test)]
mod image_tests {
    use super::*;
    use tauri::http::StatusCode;

    #[test]
    fn errors_map_to_http_status() {
        assert_eq!(image_error_status("invalid"), StatusCode::BAD_REQUEST);
        assert_eq!(image_error_status("inactive"), StatusCode::FORBIDDEN);
        assert_eq!(image_error_status("http:404"), StatusCode::NOT_FOUND);
        assert_eq!(image_error_status("http:429"), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(image_error_status("network"), StatusCode::BAD_GATEWAY);
        assert_eq!(image_error_status("http:abc"), StatusCode::BAD_GATEWAY);
    }

    #[tokio::test]
    async fn image_requests_need_both_params_and_an_active_account() {
        assert_eq!(serve_image("").await, Err("invalid".into()));
        assert_eq!(serve_image("account=usr_demo").await, Err("invalid".into()));
        // ログインしていないアカウントのセッションでは取得しない。
        let query = "account=usr_nobody&url=https%3A%2F%2Fapi.vrchat.cloud%2Fapi%2F1%2Ffile%2Ffile_ab%2F1%2Ffile";
        assert_eq!(serve_image(query).await, Err("inactive".into()));
    }
}

#[cfg(test)]
mod pacing_tests {
    use super::*;

    #[test]
    fn retry_after_reads_seconds_only() {
        assert_eq!(parse_retry_after("12"), Some(Duration::from_secs(12)));
        assert_eq!(parse_retry_after(" 0 "), Some(Duration::ZERO));
        assert_eq!(parse_retry_after("Wed, 21 Oct 2015 07:28:00 GMT"), None);
        assert_eq!(parse_retry_after("-1"), None);
    }

    #[tokio::test]
    async fn slots_are_spaced_and_hold_off_delays_them() {
        let first = reserve_slot().await;
        let second = reserve_slot().await;
        assert!(second - first >= REQUEST_INTERVAL);
        let before = tokio::time::Instant::now();
        hold_off(Duration::from_secs(3)).await;
        assert!(reserve_slot().await - before >= Duration::from_secs(3));
    }
}
