import { useEffect } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router";
import FriendScreen from "@/screens/friendScreen";
import SettingsScreen from "@/screens/settingsScreen";
import { LazyStore } from '@tauri-apps/plugin-store';
import DebugScreen from "./screens/debugScreen";
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { Confirm } from "@/components/ui/dialogs/confirm";
import { FriendDetail } from "./components/ui/dialogs/friendDetail";
import {ToastContainer} from "react-toastify";
import {InstanceDetail} from "@/components/ui/dialogs/instanceDetail.tsx";
import "@/libs/i18n";

export default function App() {
  const isDev = import.meta.env.DEV;
  const store = new LazyStore('store.json');

  useEffect(() => {
    async function init() {
      const update = await check()
      if (update?.available) {
        const mes = `App Update? \nUpdateVersion:${update.version}\nCurrentVersion:${update.currentVersion}`;
        const accepted = await Confirm.call({message: mes});
        if (accepted){
          await update.downloadAndInstall()
          await relaunch()
        }
      }
    }

    async function loadTheme() {
      const theme = await store.get<string>("data-theme");
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
