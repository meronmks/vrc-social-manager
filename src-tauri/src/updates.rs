use std::{
    sync::{Mutex, MutexGuard},
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, State, Url};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::preferences::{self, Preference};

/// 正式版のみを配信するマニフェスト（GitHub の最新正式リリースに添付される）。
const STABLE_MANIFEST: &str =
    "https://github.com/meronmks/vrc-social-manager/releases/latest/download/latest.json";
/// 正式版・ベータ・RC のうち最も新しい版を指すマニフェスト。
/// リリース公開時に `.github/workflows/update-manifest.yml` が更新する。
const BETA_MANIFEST: &str =
    "https://raw.githubusercontent.com/meronmks/vrc-social-manager/update-manifests/beta.json";
const TIMEOUT: Duration = Duration::from_secs(20);

/// 更新チャンネルごとの参照先。
/// ベータのマニフェストを取得できない場合（未作成・障害時）は正式版のマニフェストへフォールバックする。
fn endpoints(beta: bool) -> Vec<Url> {
    let urls: &[&str] = if beta {
        &[BETA_MANIFEST, STABLE_MANIFEST]
    } else {
        &[STABLE_MANIFEST]
    };
    urls.iter()
        .map(|url| url.parse().expect("更新マニフェストの URL は定数で検証済み"))
        .collect()
}

/// 確認済みの更新。インストール時に再取得せず、確認時と同じ版を適用するために保持する。
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<Update>>);

impl PendingUpdate {
    fn slot(&self) -> MutexGuard<'_, Option<Update>> {
        self.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[derive(Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdate {
    current_version: String,
    version: String,
    notes: Option<String>,
}

// 詳細はログにだけ残し、画面には失敗した段階だけを返す。
fn fail(stage: &'static str) -> impl FnOnce(tauri_plugin_updater::Error) -> String {
    move |err| {
        log::warn!("アプリ更新の{stage}に失敗しました: {err}");
        stage.into()
    }
}

fn beta_enabled(app: &AppHandle) -> Result<bool, String> {
    Ok(preferences::read(app, &Preference::BetaUpdates)?
        .as_bool()
        .unwrap_or(false))
}

/// 保存済みの更新チャンネルに従って更新を確認する。
#[tauri::command]
#[specta::specta]
pub async fn check_app_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
) -> Result<Option<AppUpdate>, String> {
    let beta = beta_enabled(&app)?;
    let update = app
        .updater_builder()
        .endpoints(endpoints(beta))
        .map_err(fail("確認"))?
        .timeout(TIMEOUT)
        .build()
        .map_err(fail("確認"))?
        .check()
        .await
        .map_err(fail("確認"))?;
    let info = update.as_ref().map(|update| AppUpdate {
        current_version: update.current_version.clone(),
        version: update.version.clone(),
        notes: update.body.clone().filter(|notes| !notes.trim().is_empty()),
    });
    *pending.slot() = update;
    Ok(info)
}

/// 直前に確認した更新をダウンロード・署名検証してインストールし、アプリを再起動する。
#[tauri::command]
#[specta::specta]
pub async fn install_app_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
) -> Result<(), String> {
    // 失敗時に再試行できるよう、保持している更新は消費せず複製して使う。
    let update = pending.slot().clone().ok_or("not-found")?;
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(fail("インストール"))?;
    // Windows ではインストーラー起動時にプロセスが終了するため、ここへ到達するのは macOS・Linux のみ。
    app.restart()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn beta_channel_falls_back_to_stable_manifest() {
        assert_eq!(endpoints(false).len(), 1);
        assert_eq!(endpoints(true)[1], endpoints(false)[0]);
        assert!(endpoints(true)
            .iter()
            .all(|url| url.scheme() == "https"));
    }
}
