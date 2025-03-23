import { useEffect } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import FriendScreen from "@/screens/friendScreen";
import SettingsScreen from "@/screens/settingsScreen";
import { LazyStore } from '@tauri-apps/plugin-store';
import DebugScreen from "./screens/debugScreen";
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { Confirm } from "@/components/ui/dialogs/confirm";
import { FriendDetail } from "./components/ui/dialogs/friendDetail";


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
      <Confirm.Root />
      <FriendDetail.Root />
      <Router>
        <Routes>
          <Route path="/" element={<FriendScreen/>} />
          <Route path="/settings" element={<SettingsScreen />} />
          {isDev && <Route path="/debug" element={<DebugScreen />} />}
        </Routes>
      </Router>
    </>
  );
}
