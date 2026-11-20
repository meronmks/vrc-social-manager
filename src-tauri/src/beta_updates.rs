use std::{collections::BTreeMap, time::Duration};

use semver::Version;
use serde::{Deserialize, Serialize};
use tauri::{Manager, Webview};
use tauri_plugin_updater::UpdaterExt;

const RELEASES: &str = "https://api.github.com/repos/meronmks/vrc-social-manager/releases";
const DOWNLOAD: &str = "https://github.com/meronmks/vrc-social-manager/releases/download";
const PAGE_SIZE: usize = 100;

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    draft: bool,
    prerelease: bool,
}

impl Release {
    fn eligible_version(&self) -> Option<Version> {
        let version = Version::parse(self.tag_name.strip_prefix('v')?).ok()?;
        if self.draft || !version.build.is_empty() {
            return None;
        }
        let eligible = if self.prerelease {
            version
                .pre
                .as_str()
                .split_once('.')
                .is_some_and(|(kind, n)| {
                    matches!(kind, "beta" | "rc")
                        && !n.is_empty()
                        && n.bytes().all(|c| c.is_ascii_digit())
                })
        } else {
            version.pre.is_empty()
        };
        eligible.then_some(version)
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
    let client = reqwest::Client::builder()
        .user_agent("VRC-Social-Manager-Updater")
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|_| "client")?;
    let current = &webview.package_info().version;
    let mut newest = current.clone();
    for page in 1.. {
        let releases: Vec<Release> = client
            .get(RELEASES)
            .query(&[("per_page", PAGE_SIZE), ("page", page)])
            .send()
            .await
            .map_err(|_| "network")?
            .error_for_status()
            .map_err(|_| "releases")?
            .json()
            .await
            .map_err(|_| "releases")?;
        if let Some(version) = releases.iter().filter_map(Release::eligible_version).max() {
            newest = newest.max(version);
        }
        if releases.len() < PAGE_SIZE {
            break;
        }
    }
    if newest == *current {
        return Ok(None);
    }
    let endpoint = format!("{DOWNLOAD}/v{newest}/latest.json")
        .parse()
        .map_err(|_| "manifest")?;
    let updater = webview
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|_| "manifest")?
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|_| "updater")?;
    let update = updater
        .check()
        .await
        .map_err(|_| "manifest")?
        .ok_or("manifest")?;
    if update.version != newest.to_string() {
        return Err("manifest".into());
    }
    Ok(Some(BetaUpdate {
        current_version: update.current_version.clone(),
        version: update.version.clone(),
        body: update.body.clone(),
        raw_json: serde_json::from_value(update.raw_json.clone()).map_err(|_| "manifest")?,
        rid: webview.resources_table().add(update),
    }))
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
