import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "react-toastify";
import { commands } from "@/bindings";
import { UpdateConfirm } from "@/components/ui/dialogs/updateConfirm";
import { userDataStore } from "@/libs/userDataStore";
import { logging } from "@/libs/logging";

const UPDATE_TIMEOUT_MS = 20000;

// 設定画面に表示するメッセージの翻訳キー
type MessageKey =
  | ""
  | "settingScreen.updateFailed"
  | "settingScreen.updateSettingsFailed"
  | "settingScreen.noUpdatesAvailable";

/** 選択中の更新チャンネル（安定版／ベータ版）で利用可能な更新を探す */
async function findUpdate(beta: boolean) {
  if (!beta) return check({ timeout: UPDATE_TIMEOUT_MS });
  const result = await commands.checkBetaUpdate();
  if (result.status === "error") throw new Error(result.error);
  const data = result.data;
  return data ? new Update({ ...data, body: data.body ?? undefined }) : null;
}

/** マニフェストに本文がなければ GitHub のリリースノートを取得する */
async function loadReleaseNotes(update: Update) {
  if (update.body) return update.body;
  try {
    const result = await commands.getReleaseNote(update.version);
    if (result.status === "ok") return JSON.parse(result.data).body as string | undefined;
  } catch {
    /* リリースノートを取得できない場合もバージョンは表示する。 */
  }
  return undefined;
}

/** 更新内容を確認し、承認されたらインストールして再起動する */
async function confirmUpdate(update: Update) {
  const releaseNotes = await loadReleaseNotes(update);
  if (await UpdateConfirm.call({ version: update.version, releaseNotes })) {
    await update.downloadAndInstall();
    await relaunch();
  }
}

export function useAppUpdates(promptOnStartup: boolean) {
  const { t } = useTranslation();
  const [beta, setBeta] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<Update | null>(null);
  const [message, setMessage] = useState<MessageKey>("");
  const lock = useRef(false);

  // 保持している Update リソースは差し替え・アンマウント時に解放する
  useEffect(() => () => {
    if (available) void available.close().catch(() => {});
  }, [available]);

  /** 更新処理を排他的に実行し、失敗時はメッセージ表示とログ出力を行う */
  async function run(action: () => Promise<void>, report: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage("settingScreen.updateFailed");
      if (report) toast.error(t("settingScreen.updateFailed"));
      void logging.warn(`アプリの更新処理に失敗しました: ${error}`).catch(() => {});
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function lookup(selected: boolean, prompt: boolean) {
    setBeta(selected);
    setAvailable(null);
    const found = await findUpdate(selected);
    setAvailable(found);
    if (found && prompt) await confirmUpdate(found);
    if (!found) setMessage("settingScreen.noUpdatesAvailable");
  }

  useEffect(() => {
    let live = true;
    Promise.all([userDataStore.getBetaUpdates(), userDataStore.getAutoCheckUpdates()])
      .then(([selected, auto]) => {
        if (!live) return;
        setBeta(selected);
        if (auto) void run(() => lookup(selected, promptOnStartup), promptOnStartup);
      })
      .catch(() => { if (live) setMessage("settingScreen.updateSettingsFailed"); });
    return () => { live = false; };
  }, []);

  function checkNow() {
    return run(async () => lookup(await userDataStore.getBetaUpdates(), true), true);
  }

  function changeBeta(selected: boolean) {
    return run(async () => {
      try {
        await userDataStore.setBetaUpdates(selected);
      } catch {
        setMessage("settingScreen.updateSettingsFailed");
        return;
      }
      await lookup(selected, true);
    }, true);
  }

  function showAvailable() {
    if (available) return run(() => confirmUpdate(available), true);
  }

  return { beta, busy, available, message: message ? t(message) : "", checkNow, changeBeta, showAvailable };
}

export type AppUpdates = ReturnType<typeof useAppUpdates>;
