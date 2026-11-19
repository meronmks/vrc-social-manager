use serde_json::Value;
use tauri_plugin_store::Store;

fn compact_users(raw: &str) -> Result<Option<String>, serde_json::Error> {
    let mut users: Vec<Value> = serde_json::from_str(raw)?;
    let mut changed = false;
    for user in &mut users {
        let Some(row) = user.as_object_mut() else {
            continue;
        };
        let Some(raw_profile) = row.remove("userData") else {
            continue;
        };
        changed = true;
        let Some(profile) = raw_profile
            .as_str()
            .and_then(|s| serde_json::from_str::<Value>(s).ok())
        else {
            continue;
        };
        let Some(id) = row
            .get("id")
            .and_then(Value::as_str)
            .filter(|id| !id.is_empty())
        else {
            continue;
        };
        if profile["id"].as_str() != Some(id) {
            continue;
        }
        if row
            .get("loginId")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .is_empty()
        {
            if let Some(login) = ["username", "email"]
                .iter()
                .find_map(|key| profile[*key].as_str().filter(|v| !v.is_empty()))
            {
                row.insert("loginId".into(), Value::from(login));
            }
        }
        for key in [
            "userIcon",
            "iconUrl",
            "profilePicOverrideThumbnail",
            "profilePicOverride",
            "currentAvatarThumbnailImageUrl",
            "imageUrl",
            "currentAvatarImageUrl",
        ] {
            if let Some(url) = profile[key].as_str().filter(|s| s.starts_with("https://")) {
                row.entry(key).or_insert_with(|| Value::from(url));
            }
        }
    }
    if changed {
        Ok(Some(serde_json::to_string(&users)?))
    } else {
        Ok(None)
    }
}

pub(super) fn migrate(store: &Store<tauri::Wry>) -> Result<(), Box<dyn std::error::Error>> {
    let mut changed = false;
    if let Some(Value::String(raw)) = store.get("users") {
        match compact_users(&raw) {
            Ok(Some(users)) => {
                store.set("users", users);
                changed = true;
            }
            Ok(None) => {}
            // 壊れた登録は上書きせず、画面の既存のストアエラー処理に渡す。
            Err(_) => log::warn!("旧形式のアカウント一覧を読み取れませんでした"),
        }
    }
    changed |= store.delete("instances-data");
    changed |= store.delete("user-data");
    if changed {
        store.save()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn compacts_all_profiles_and_only_trusts_a_matching_id() {
        let rows = json!([
            {"id":"a", "userData":json!({"id":"a", "email":"a@example.invalid", "other":"private", "userIcon":"https://example.invalid/a"}).to_string()},
            {"id":"b", "userData":json!({"id":"wrong", "username":"wrong"}).to_string()},
            {"id":"c", "loginId":"keep", "userData":json!({"id":"c", "username":"old"}).to_string()},
            {"id":"d", "userData":"invalid"}
        ]);
        let compact = compact_users(&rows.to_string()).unwrap().unwrap();
        assert_eq!(
            serde_json::from_str::<Value>(&compact).unwrap(),
            json!([
                {"id":"a", "loginId":"a@example.invalid", "userIcon":"https://example.invalid/a"},
                {"id":"b"}, {"id":"c", "loginId":"keep"}, {"id":"d"}
            ])
        );
        assert!(compact_users(&compact).unwrap().is_none());
        assert!(compact_users("invalid").is_err());
    }
}
