import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { FiArrowLeft, FiFolder, FiSearch } from "react-icons/fi";
import { appLogDir } from "@tauri-apps/api/path";
import { commands, LogEntry } from "@/bindings";
import { useText } from "@/libs/social";

// 画面を開いている間、この間隔で新しいログを取りに行く。
const POLL_MS = 2000;
// 画面に保持する件数の上限（Rust 側の保持件数と同じ）。
const MAX_ROWS = 2000;

type Level = "all" | "problems";

// Rust 側から差分で動作ログを受け取り続ける。
function useLogs() {
  const [rows, setRows] = useState<LogEntry[]>([]);
  const [failed, setFailed] = useState(false);
  const last = useRef<number | null>(null);
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const added = await commands.logsGet(last.current);
        if (!live) return;
        setFailed(false);
        if (!added.length) return;
        last.current = added[added.length - 1].seq;
        setRows((prev) => [...prev, ...added].slice(-MAX_ROWS));
      } catch {
        if (live) setFailed(true);
      }
    }
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  async function clear() {
    await commands.logsClear();
    setRows([]);
  }
  return { rows, failed, clear };
}

// 出力元を短く表示する（`vsm_lib::social` → `social`、画面側のログは `画面`）。
function source(target: string, screen: string) {
  if (target.startsWith("webview")) return screen;
  return target.replace(/^vsm_lib(::)?/, "") || "app";
}

function timestamp(time: number) {
  const d = new Date(time);
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return d.toLocaleTimeString([], { hour12: false }) + "." + ms;
}

// 一覧の 1 行をコピー用の 1 行テキストにする。
function plain(row: LogEntry) {
  return `${new Date(row.time).toISOString()} [${row.level}] ${row.target}: ${row.message}`;
}

// 設定のサブ画面。API 通信の失敗理由などの動作ログを新しい順に表示する。
export default function LogsScreen() {
  const t = useText();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { rows, failed, clear } = useLogs();
  const [level, setLevel] = useState<Level>("all");
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("");
  const [copied, setCopied] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  useEffect(() => {
    appLogDir()
      .then(setFolder)
      .catch(() => {});
  }, []);

  const search = query.trim().toLowerCase();
  const screen = t("画面", "UI");
  const visible = rows
    .filter((r) => level === "all" || r.level === "ERROR" || r.level === "WARN")
    .filter((r) => !search || (r.message + " " + r.target).toLowerCase().includes(search))
    .reverse();
  const back = () => (state?.fromSettings ? navigate(-1) : navigate("/settings", { replace: true }));
  async function openFolder() {
    try {
      const result = await commands.logsOpenFolder();
      setOpenFailed(result.status !== "ok");
    } catch {
      setOpenFailed(true);
    }
  }
  async function copy() {
    try {
      // 表示中の内容を、時系列（古い順）のテキストとしてコピーする。
      await navigator.clipboard.writeText([...visible].reverse().map(plain).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <section className="settings-page licenses-page logs-page" aria-labelledby="logs-title">
      <button className="license-back" onClick={back}>
        <FiArrowLeft aria-hidden="true" /> {t("設定に戻る", "Back to settings")}
      </button>
      <h1 id="logs-title">{t("動作ログ", "Activity log")}</h1>
      <p className="logs-help">
        {t(
          "起動してからのアプリの動作記録です。通信に失敗したときは、どの要求がどんな理由で失敗したかを確認できます。",
          "What the app has done since it started. When a request fails, you can see which one and why.",
        )}
      </p>
      <div className="license-tools">
        <div className="segmented" role="group" aria-label={t("表示するログ", "Entries to show")}>
          <button aria-pressed={level === "all"} onClick={() => setLevel("all")}>
            {t("すべて", "All")}
          </button>
          <button aria-pressed={level === "problems"} onClick={() => setLevel("problems")}>
            {t("警告とエラー", "Warnings and errors")}
          </button>
        </div>
        <label className="search-box">
          <FiSearch aria-hidden="true" />
          <input
            type="search"
            aria-label={t("ログを検索", "Search the log")}
            placeholder={t("ログを検索", "Search the log")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="quiet-action" disabled={!visible.length} onClick={() => void copy()}>
          {copied ? t("コピーしました", "Copied") : t("コピー", "Copy")}
        </button>
        <button className="quiet-action" disabled={!rows.length} onClick={() => void clear()}>
          {t("消去", "Clear")}
        </button>
      </div>
      {failed && (
        <div className="list-state warn" role="alert">
          {t("動作ログを読み込めませんでした", "Could not load the activity log")}
        </div>
      )}
      <div className="log-list" role="log" aria-live="off">
        {visible.length ? (
          visible.map((row) => (
            <div key={row.seq} className="log-row" data-level={row.level}>
              <time dateTime={new Date(row.time).toISOString()}>{timestamp(row.time)}</time>
              <span className="log-level">{row.level}</span>
              <span className="log-source">{source(row.target, screen)}</span>
              <span className="log-message">{row.message}</span>
            </div>
          ))
        ) : (
          <p className="empty-text" role="status">
            {search || level !== "all"
              ? t("一致するログはありません", "No matching entries")
              : t("まだログはありません", "No entries yet")}
          </p>
        )}
      </div>
      <div className="logs-folder">
        <p className="logs-help">
          {t("以前の起動分を含むログファイルの保存先:", "Log files, including earlier runs, are saved in:")}{" "}
          {folder && <code>{folder}</code>}
        </p>
        <button className="quiet-action" onClick={() => void openFolder()}>
          <FiFolder aria-hidden="true" />
          {t("フォルダを開く", "Open folder")}
        </button>
      </div>
      {openFailed && (
        <p className="form-error" role="alert">
          {t("ログの保存先を開けませんでした", "Could not open the log folder")}
        </p>
      )}
    </section>
  );
}
