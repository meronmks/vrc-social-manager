use std::{collections::BTreeMap, fmt::Display, time::Duration};

use log::warn;
use semver::{Prerelease, Version};
use serde::{Deserialize, Serialize};
use tauri::{Manager, Webview};
use tauri_plugin_updater::{Update, UpdaterExt};

const RELEASES: &str = "https://api.github.com/repos/meronmks/vrc-social-manager/releases";
const DOWNLOAD: &str = "https://github.com/meronmks/vrc-social-manager/releases/download";
const PAGE_SIZE: usize = 100;
const TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    draft: bool,
    prerelease: bool,
}

impl Release {
    /// 更新対象にできるリリースならそのバージョンを返す。
    /// 公開済みの安定版、または `beta.N` / `rc.N` 形式のプレリリースのみ対象とする。
    fn eligible_version(&self) -> Option<Version> {
        let version = Version::parse(self.tag_name.strip_prefix('v')?).ok()?;
        if self.draft || !version.build.is_empty() {
            return None;
        }
        let eligible = if self.prerelease {
            is_beta_or_rc(&version.pre)
        } else {
            version.pre.is_empty()
        };
        eligible.then_some(version)
    }
}

/// プレリリース識別子が `beta.N` または `rc.N`（N は数字のみ）かを判定する。
fn is_beta_or_rc(pre: &Prerelease) -> bool {
    pre.as_str().split_once('.').is_some_and(|(kind, n)| {
        matches!(kind, "beta" | "rc") && !n.is_empty() && n.bytes().all(|c| c.is_ascii_digit())
    })
}

/// フロントエンドには分類用のコードだけを返し、エラーの詳細はログに残す。
fn fail<E: Display>(code: &'static str) -> impl FnOnce(E) -> String {
    move |error| {
        warn!("ベータ版の更新確認に失敗しました ({code}): {error}");
        code.to_string()
    }
}

// Update の実体は WebView のリソースとして保持し、インストール時はプラグインが署名を検証する。
#[derive(Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct BetaUpdate {
    rid: u32,
    current_version: String,
    version: String,
    body: Option<String>,
    raw_json: BTreeMap<String, serde_json::Value>,
}

#[tauri::command]
#[specta::specta]
pub async fn check_beta_update(webview: Webview) -> Result<Option<BetaUpdate>, String> {
    let current = &webview.package_info().version;
    let newest = fetch_newest_version(current).await?;
    if newest == *current {
        return Ok(None);
    }
    let update = fetch_update(&webview, &newest).await?;
    Ok(Some(BetaUpdate {
        current_version: update.current_version.clone(),
        version: update.version.clone(),
        body: update.body.clone(),
        raw_json: serde_json::from_value(update.raw_json.clone()).map_err(fail("manifest"))?,
        rid: webview.resources_table().add(update),
    }))
}

/// GitHub のリリース一覧を全ページ走査し、現在のバージョン以上で最新の対象バージョンを返す。
async fn fetch_newest_version(current: &Version) -> Result<Version, String> {
    let client = reqwest::Client::builder()
        .user_agent("VRC-Social-Manager-Updater")
        .timeout(TIMEOUT)
        .build()
        .map_err(fail("client"))?;
    let mut newest = current.clone();
    for page in 1.. {
        let releases: Vec<Release> = client
            .get(RELEASES)
            .query(&[("per_page", PAGE_SIZE), ("page", page)])
            .send()
            .await
            .map_err(fail("network"))?
            .error_for_status()
            .map_err(fail("releases"))?
            .json()
            .await
            .map_err(fail("releases"))?;
        if let Some(version) = releases.iter().filter_map(Release::eligible_version).max() {
            newest = newest.max(version);
        }
        if releases.len() < PAGE_SIZE {
            break;
        }
    }
    Ok(newest)
}

/// 指定バージョンの latest.json を取得し、バージョンが一致する更新情報を返す。
async fn fetch_update(webview: &Webview, version: &Version) -> Result<Update, String> {
    let endpoint = format!("{DOWNLOAD}/v{version}/latest.json")
        .parse()
        .map_err(fail("manifest"))?;
    let update = webview
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(fail("manifest"))?
        .timeout(TIMEOUT)
        .build()
        .map_err(fail("updater"))?
        .check()
        .await
        .map_err(fail("manifest"))?
        .ok_or_else(|| fail("manifest")("latest.json に更新情報がありません"))?;
    if update.version != version.to_string() {
        return Err(fail("manifest")(format!(
            "latest.json のバージョン {} が {version} と一致しません",
            update.version
        )));
    }
    Ok(update)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selects_published_versions_in_semver_order() {
        let release = |tag: &str, draft, prerelease| {
            Release {
                tag_name: tag.into(),
                draft,
                prerelease,
            }
            .eligible_version()
        };
        assert!(release("v1.0.0-beta.10", false, true) > release("v1.0.0-beta.2", false, true));
        assert!(release("v1.0.0", false, false) > release("v1.0.0-rc.1", false, true));
        assert!(release("v1.0.0-beta.1", true, true).is_none());
        assert!(release("v1.0.0-beta.1", false, false).is_none());
        assert!(release("v1.0.0-alpha.1", false, true).is_none());
        assert!(release("v1.0.0", false, true).is_none());
    }
}
