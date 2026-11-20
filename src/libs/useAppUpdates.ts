import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "react-toastify";
import { commands } from "@/bindings";
import { UpdateConfirm } from "@/components/ui/dialogs/updateConfirm";
import { userDataStore } from "@/libs/userDataStore";
import { logging } from "@/libs/logging";

async function findUpdate(beta: boolean) {
  if (!beta) return check({ timeout: 20000 });
  const result = await commands.checkBetaUpdate();
  if (result.status === "error") throw new Error(result.error);
  const data = result.data;
  return data ? new Update({ ...data, body: data.body ?? undefined }) : null;
}

async function confirmUpdate(update: Update) {
  let notes = update.body;
  if (!notes) {
    try {
      const result = await commands.getReleaseNote(update.version);
      if (result.status === "ok") notes = JSON.parse(result.data).body;
    } catch {
      /* リリースノートを取得できない場合もバージョンは表示する。 */
    }
  }
  if (await UpdateConfirm.call({ version: update.version, releaseNotes: notes })) {
    await update.downloadAndInstall();
    await relaunch();
  }
}

export function useAppUpdates(promptOnStartup: boolean) {
  const { t } = useTranslation();
  const [beta, setBeta] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<Update | null>(null);
  const [message, setMessage] = useState("");
  const lock = useRef(false);

  useEffect(() => () => {
    if (available) void available.close().catch(() => {});
  }, [available]);

  async function run(action: () => Promise<void>, report: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch {
      setMessage("settingScreen.updateFailed");
      if (report) toast.error(t("settingScreen.updateFailed"));
      void logging.warn("アプリの更新処理に失敗しました").catch(() => {});
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function lookup(selected: boolean, prompt: boolean) {
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
    return run(async () => {
      const selected = await userDataStore.getBetaUpdates();
      setBeta(selected);
      await lookup(selected, true);
    }, true);
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
      await lookup(selected, true);
    }, true);
  }

  function showAvailable() {
    if (available) return run(() => confirmUpdate(available), true);
  }

  return { beta, busy, available, message: message ? t(message) : "", checkNow, changeBeta, showAvailable };
}

export type AppUpdates = ReturnType<typeof useAppUpdates>;
