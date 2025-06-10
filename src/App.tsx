import { useEffect } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router";
import FriendScreen from "@/screens/friendScreen";
import SettingsScreen from "@/screens/settingsScreen";
import DebugScreen from "@/screens/debugScreen";
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { Confirm } from "@/components/ui/dialogs/confirm";
import { FriendDetail } from "@/components/ui/dialogs/friendDetail";
import { ToastContainer } from "react-toastify";
import { InstanceDetail } from "@/components/ui/dialogs/instanceDetail.tsx";
import { Login } from "@/components/ui/dialogs/login";
import { toastError } from "@/components/toast";
import "@/libs/i18n";
import {logging} from "@/libs/logging.tsx";
import { UpdateConfirm } from "@/components/ui/dialogs/updateConfirm";
import { userDataStore } from "./libs/userDataStore";

export default function App() {
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    async function init() {
      // アップデートチェックの設定を読み込む
      const autoCheckUpdates = await userDataStore.getAutoCheckUpdates();
      // 設定が未定義の場合はデフォルトでtrue
      if (autoCheckUpdates !== false) {
        try {
          await logging.info("Check for updates")
          const update = await check();
          if (update) {
            const result = await UpdateConfirm.call({
              version: update.version,
              releaseNotes: update.body,
            });
            if (result){
              await update.downloadAndInstall()
              await relaunch()
            }
          } else {
            await logging.info("No updates available")
          }
        } catch (error) {
          toastError("Update check failed: " + error);
        }
      }
    }

    async function loadTheme() {
      const theme = await userDataStore.getTheme();
      if (theme) {
        document.documentElement.setAttribute("data-theme", theme);
      }
    }
    loadTheme();
    init();
  }, []);

  return (
    <>
      <ToastContainer />
      <Confirm.Root />
      <FriendDetail.Root />
      <InstanceDetail.Root />
      <Login.Root />
      <UpdateConfirm.Root />
      {/* 理由がよくわからんがメインコンテンツをw-screenで覆わないとダイアログ表示時になんかズレる */}
      <div className="w-screen">
        <Router>
          <Routes>
            <Route path="/" element={<FriendScreen/>} />
            <Route path="/settings" element={<SettingsScreen />} />
            {isDev && <Route path="/debug" element={<DebugScreen />} />}
          </Routes>
        </Router>
      </div>
    </>
  );
}
