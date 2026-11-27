// アプリ内で動作ログを読めるよう、出力されたログの直近分をメモリに保持する。
// ファイルへの出力（tauri-plugin-log の LogDir）はそのまま残し、こちらは表示専用。
use once_cell::sync::Lazy;
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri_plugin_log::fern;

/// ログファイル 1 つあたりの大きさ（MB）の既定値と上限。
pub const DEFAULT_FILE_SIZE_MB: u64 = 2;
pub const MAX_FILE_SIZE_MB: u64 = 20;
/// 残しておく過去のログファイル数（書き込み中のファイルは含まない）の既定値と上限。
/// 0 にするとプラグイン内部の計算が桁あふれするため、最小は 1。
pub const DEFAULT_FILES_KEPT: u64 = 5;
pub const MAX_FILES_KEPT: u64 = 20;

// 保持する件数の上限。古いものから捨てる。
const CAPACITY: usize = 2000;
// 1件あたりの本文の上限（文字数）。長い応答などで画面とメモリを圧迫しないようにする。
const MAX_MESSAGE_CHARS: usize = 4000;

#[derive(Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    /// 起動してからの通し番号。差分取得に使う。
    pub seq: u32,
    /// 記録した時刻（UNIX エポックからのミリ秒）
    // 常に有限値なので、TypeScript 側では null を含まない number として扱う
    #[specta(type = specta_typescript::Number)]
    pub time: f64,
    /// "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE"
    pub level: String,
    /// 出力元のモジュール（例: `vsm_lib::social`、画面側は `webview`）
    pub target: String,
    pub message: String,
}

struct Buffer {
    next: u32,
    rows: VecDeque<LogEntry>,
}

static BUFFER: Lazy<Mutex<Buffer>> = Lazy::new(|| {
    Mutex::new(Buffer {
        next: 1,
        rows: VecDeque::with_capacity(CAPACITY),
    })
});

// 全体の書式（`[日付][時刻][出力元][レベル] 本文`）が付いた行から本文だけを取り出す。
fn strip_prefix<'a>(formatted: &'a str, level: &str) -> &'a str {
    let marker = format!("[{level}] ");
    formatted
        .find(&marker)
        .map(|i| &formatted[i + marker.len()..])
        .unwrap_or(formatted)
}

fn push(record: &log::Record) {
    let level = record.level().to_string();
    let formatted = record.args().to_string();
    let mut message: String = strip_prefix(&formatted, &level).to_string();
    if message.chars().count() > MAX_MESSAGE_CHARS {
        message = message.chars().take(MAX_MESSAGE_CHARS).collect::<String>() + "…";
    }
    let time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as f64)
        .unwrap_or_default();
    // ここでログを出すと再帰するため、ロックの失敗も黙って続行する。
    let mut buffer = BUFFER.lock().unwrap_or_else(|e| e.into_inner());
    let seq = buffer.next;
    buffer.next = buffer.next.wrapping_add(1);
    if buffer.rows.len() >= CAPACITY {
        buffer.rows.pop_front();
    }
    buffer.rows.push_back(LogEntry {
        seq,
        time,
        level,
        target: record.target().to_string(),
        message,
    });
}

/// ログプラグインに追加する出力先。受け取ったログをメモリに保持する。
pub fn target() -> tauri_plugin_log::Target {
    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Dispatch(
        fern::Dispatch::new().chain(fern::Output::call(push)),
    ))
}

/// 保持している動作ログを古い順に返す。`after` を渡すとその番号より後のものだけを返す。
#[tauri::command]
#[specta::specta]
pub fn logs_get(after: Option<u32>) -> Vec<LogEntry> {
    let buffer = BUFFER.lock().unwrap_or_else(|e| e.into_inner());
    buffer
        .rows
        .iter()
        .filter(|row| after.is_none_or(|after| row.seq > after))
        .cloned()
        .collect()
}

/// ログファイルの保存先フォルダを OS のファイルマネージャーで開く。
#[tauri::command]
#[specta::specta]
pub fn logs_open_folder(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let dir = app.path().app_log_dir().map_err(|e| {
        log::warn!("ログの保存先を特定できませんでした: {e}");
        "unavailable".to_string()
    })?;
    // まだ一度もファイルに書き出していない場合に備えて作っておく。
    std::fs::create_dir_all(&dir).map_err(|e| {
        log::warn!("ログの保存先を作成できませんでした: {e}");
        "unavailable".to_string()
    })?;
    // 開くのはアプリが決めた固定のフォルダだけで、画面から渡された値は使わない。
    #[cfg(target_os = "windows")]
    let program = "explorer";
    #[cfg(target_os = "macos")]
    let program = "open";
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let program = "xdg-open";
    // explorer は成功しても終了コード 1 を返すため、起動できたかだけを見る。
    std::process::Command::new(program)
        .arg(&dir)
        .spawn()
        .map(|_| ())
        .map_err(|e| {
            log::warn!("ログの保存先を開けませんでした（{program}）: {e}");
            "unavailable".to_string()
        })
}

/// 画面に表示している動作ログを消す（ログファイルは消さない）。
#[tauri::command]
#[specta::specta]
pub fn logs_clear() {
    BUFFER
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .rows
        .clear();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefix_is_removed_only_up_to_the_level() {
        assert_eq!(
            strip_prefix(
                "[2026-11-25][12:00:00][vsm_lib::social][WARN] GET /x: HTTP 404",
                "WARN"
            ),
            "GET /x: HTTP 404"
        );
        // 本文に同じ表記が含まれていても、最初の一つ（書式部分）だけを取り除く。
        assert_eq!(
            strip_prefix("[d][t][m][INFO] a [INFO] b", "INFO"),
            "a [INFO] b"
        );
        assert_eq!(strip_prefix("no prefix", "INFO"), "no prefix");
    }
}
