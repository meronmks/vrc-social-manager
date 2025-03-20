import { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import FriendScreen from "@/screens/friendScreen";
import SettingsScreen from "@/screens/settingsScreen";
import FriendDetailDialog, { Friend } from "@/components/friendDetailDialog"
import { LazyStore } from '@tauri-apps/plugin-store';
import DebugScreen from "./screens/debugScreen";

export default function App() {
  const isDev = import.meta.env.DEV;
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const store = new LazyStore('store.json');

  useEffect(() => {
    async function loadTheme() {
      const theme = await store.get<string>("data-theme");
      if (theme) {
        document.documentElement.setAttribute("data-theme", theme);
      }
    }
    loadTheme();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<FriendScreen onFriendSelect={setSelectedFriend} />} />
        <Route path="/settings" element={<SettingsScreen />} />
        {isDev && <Route path="/debug" element={<DebugScreen />} />}
      </Routes>
      {selectedFriend && (
        <FriendDetailDialog friend={selectedFriend} onClose={() => setSelectedFriend(null)} />
      )}
    </Router>
  );
}
