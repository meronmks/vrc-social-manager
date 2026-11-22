use crate::cache;
use serde::Deserialize;
use serde_json::Value;
use tauri_plugin_store::StoreExt;

#[derive(Deserialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Preference {
    Theme,
    Language,
    FetchFriendsCount,
    ImageCacheLimit,
    CacheLifetime,
    AutoCheckUpdates,
    BetaUpdates,
    ShowAllFriends { account: String },
    FavoriteGroup { account: String },
    Accounts,
    CurrentAccount,
}

impl Preference {
    fn key(&self) -> String {
        match self {
            Self::Theme => "data-theme".into(),
            Self::Language => "lang".into(),
            Self::FetchFriendsCount => "fetch-friends-count".into(),
            Self::ImageCacheLimit => "image-cache-limit-mb".into(),
            Self::CacheLifetime => "cache-lifetime-hours".into(),
            Self::BetaUpdates => "beta-updates".into(),
            Self::AutoCheckUpdates => "auto-check-updates".into(),
            Self::ShowAllFriends { account } => format!("show-all-friends-{account}"),
            Self::FavoriteGroup { account } => format!("favorite-group-{account}"),
            Self::Accounts => "users".into(),
            Self::CurrentAccount => "current-user-id".into(),
        }
    }

    fn writable(&self, value: &Value) -> bool {
        match self {
            Self::Theme => matches!(value.as_str(), Some("light" | "dark")),
            Self::Language => matches!(value.as_str(), Some("ja" | "en")),
            Self::FetchFriendsCount => value.as_u64().is_some_and(|n| (1..=100).contains(&n)),
            Self::ImageCacheLimit => value
                .as_u64()
                .is_some_and(|n| n <= cache::MAX_IMAGE_LIMIT_MB),
            Self::CacheLifetime => value
                .as_u64()
                .is_some_and(|n| n <= cache::MAX_LIFETIME_HOURS),
            Self::AutoCheckUpdates | Self::BetaUpdates | Self::ShowAllFriends { .. } => value.is_boolean(),
            Self::FavoriteGroup { .. } => value
                .as_str()
                .is_some_and(|s| !s.is_empty() && s.len() <= 256),
            Self::Accounts | Self::CurrentAccount => false,
        }
    }
}

fn accounts(raw: Value) -> Result<Value, String> {
    if raw.is_null() {
        return Ok(Value::Array(Vec::new()));
    }
    let mut rows: Vec<Value> =
        serde_json::from_str(raw.as_str().ok_or("storage")?).map_err(|_| "storage")?;
    for row in &mut rows {
        row.as_object_mut().ok_or("storage")?.retain(|key, _| {
            matches!(
                key.as_str(),
                "id" | "displayName"
                    | "lastLogin"
                    | "loginId"
                    | "userIcon"
                    | "iconUrl"
                    | "profilePicOverrideThumbnail"
                    | "profilePicOverride"
                    | "currentAvatarThumbnailImageUrl"
                    | "imageUrl"
                    | "currentAvatarImageUrl"
            )
        });
    }
    Ok(Value::Array(rows))
}

/// 設定値を読む。Rust 側から参照する場合もキー名を重複定義しないようこれを使う。
pub(crate) fn read(app: &tauri::AppHandle, setting: &Preference) -> Result<Value, String> {
    let store = app.store("store.json").map_err(|_| "storage")?;
    let value = store.get(setting.key()).unwrap_or(Value::Null);
    if matches!(setting, Preference::Accounts) {
        accounts(value)
    } else {
        Ok(value)
    }
}

/// 保存済みのキャッシュ上限をキャッシュへ反映する。未設定・不正な値は既定値を使う。
pub(crate) fn apply_cache_limits(app: &tauri::AppHandle) {
    let number = |setting: Preference, default: u64| {
        read(app, &setting)
            .ok()
            .filter(|value| setting.writable(value))
            .and_then(|value| value.as_u64())
            .unwrap_or(default)
    };
    cache::set_image_limit_mb(number(
        Preference::ImageCacheLimit,
        cache::DEFAULT_IMAGE_LIMIT_MB,
    ));
    cache::set_lifetime_hours(number(
        Preference::CacheLifetime,
        cache::DEFAULT_LIFETIME_HOURS,
    ));
}

#[tauri::command]
#[specta::specta]
pub fn settings_get(app: tauri::AppHandle, setting: Preference) -> Result<Value, String> {
    read(&app, &setting)
}

#[tauri::command]
#[specta::specta]
pub fn settings_set(
    app: tauri::AppHandle,
    setting: Preference,
    value: Value,
) -> Result<(), String> {
    if !setting.writable(&value) {
        return Err("invalid".into());
    }
    let store = app.store("store.json").map_err(|_| "storage")?;
    if let Preference::ShowAllFriends { account } | Preference::FavoriteGroup { account } = &setting
    {
        if store
            .get("current-user-id")
            .as_ref()
            .and_then(Value::as_str)
            != Some(account.as_str())
        {
            return Err("inactive".into());
        }
    }
    store.set(setting.key(), value);
    store.save().map_err(|_| "storage")?;
    if matches!(
        setting,
        Preference::ImageCacheLimit | Preference::CacheLifetime
    ) {
        apply_cache_limits(&app);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn account_registration_is_read_only() {
        assert!(!Preference::Accounts.writable(&json!([])));
        assert!(!Preference::CurrentAccount.writable(&json!("example")));
        assert!(Preference::FetchFriendsCount.writable(&json!(100)));
        assert!(!Preference::FetchFriendsCount.writable(&json!(101)));
        assert!(Preference::ImageCacheLimit.writable(&json!(0)));
        assert!(Preference::ImageCacheLimit.writable(&json!(cache::MAX_IMAGE_LIMIT_MB)));
        assert!(!Preference::ImageCacheLimit.writable(&json!(cache::MAX_IMAGE_LIMIT_MB + 1)));
        assert!(!Preference::ImageCacheLimit.writable(&json!(-1)));
        assert!(!Preference::CacheLifetime.writable(&json!(1.5)));
        assert!(!Preference::CacheLifetime.writable(&json!(cache::MAX_LIFETIME_HOURS + 1)));
        assert!(!Preference::ShowAllFriends {
            account: "example".into()
        }
        .writable(&json!("true")));
    }

    #[test]
    fn account_list_only_contains_visible_fields() {
        let rows = json!([{"id":"a","displayName":"demo","userData":"fixture","other":"hidden"}]);
        assert_eq!(
            accounts(json!(rows.to_string())).unwrap(),
            json!([{"id":"a","displayName":"demo"}])
        );
    }
}
