import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { commands, type AppUpdate } from "@/bindings";
import { UpdateConfirm } from "@/components/ui/dialogs/updateConfirm";
import { userDataStore } from "@/libs/userDataStore";
import { logging } from "@/libs/logging";

// 更新チャンネルの選択・確認・インストールは Rust 側（updates.rs）が担い、ここは画面との橋渡しだけを行う。
async function findUpdate() {
  const result = await commands.checkAppUpdate();
  if (result.status === "error") throw new Error(result.error);
  return result.data;
}

async function confirmUpdate(update: AppUpdate) {
  let notes = update.notes ?? undefined;
  if (!notes) {
    try {
      const result = await commands.getReleaseNote(update.version);
      if (result.status === "ok") notes = JSON.parse(result.data).body;
    } catch {
      /* リリースノートを取得できない場合もバージョンは表示する。 */
    }
  }
  if (await UpdateConfirm.call({ version: update.version, releaseNotes: notes })) {
    // 成功時はアプリが再起動するため戻らない。
    const result = await commands.installAppUpdate();
    if (result.status === "error") throw new Error(result.error);
  }
}

export function useAppUpdates(promptOnStartup: boolean) {
  const { t } = useTranslation();
  const [beta, setBeta] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<AppUpdate | null>(null);
  const [message, setMessage] = useState("");
  const lock = useRef(false);

  async function run(action: () => Promise<void>, report: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage("settingScreen.updateFailed");
      if (report) toast.error(t("settingScreen.updateFailed"));
      void logging.warn(`アプリの更新処理に失敗しました: ${e instanceof Error ? e.message : e}`).catch(() => {});
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function lookup(prompt: boolean) {
    setAvailable(null);
    const found = await findUpdate();
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
        if (auto) void run(() => lookup(promptOnStartup), promptOnStartup);
      })
      .catch(() => { if (live) setMessage("settingScreen.updateSettingsFailed"); });
    return () => { live = false; };
  }, []);

  function checkNow() {
    return run(() => lookup(true), true);
  }

  function changeBeta(selected: boolean) {
    return run(async () => {
      try {
        await userDataStore.setBetaUpdates(selected);
      } catch {
        setMessage("settingScreen.updateSettingsFailed");
        return;
      }
      setBeta(selected);
      // 保存したチャンネルで確認し直す（Rust 側が保存値を読む）。
      await lookup(true);
    }, true);
  }

  function showAvailable() {
    if (available) return run(() => confirmUpdate(available), true);
  }

  return { beta, busy, available, message: message ? t(message) : "", checkNow, changeBeta, showAvailable };
}

export type AppUpdates = ReturnType<typeof useAppUpdates>;
