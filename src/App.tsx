import { useEffect } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router";
import FriendScreen from "@/screens/friendScreen";
import SettingsScreen from "@/screens/settingsScreen";
import DebugScreen from "@/screens/debugScreen";
import { Confirm } from "@/components/ui/dialogs/confirm";
import { FriendDetail } from "@/components/ui/dialogs/friendDetail";
import { ToastContainer } from "react-toastify";
import { InstanceDetail } from "@/components/ui/dialogs/instanceDetail.tsx";
import { Login } from "@/components/ui/dialogs/login";
import "@/libs/i18n";
import { UpdateConfirm } from "@/components/ui/dialogs/updateConfirm";
import { ThirdPartyLicenses } from "@/components/ui/dialogs/license";
import { userDataStore } from "@/libs/userDataStore";
import { useAppUpdates } from "@/libs/useAppUpdates";

export default function App() {
  const updates = useAppUpdates(true);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    async function loadTheme() {
      const theme = await userDataStore.getTheme();
      if (theme) {
        document.documentElement.setAttribute("data-theme", theme);
      }
    }
    loadTheme();
  }, []);

  return (
    <>
      <ToastContainer />
      <Confirm.Root />
      <FriendDetail.Root />
      <InstanceDetail.Root />
      <Login.Root />
      <UpdateConfirm.Root />
      <ThirdPartyLicenses.Root />
      {/* 理由がよくわからんがメインコンテンツをw-screenで覆わないとダイアログ表示時になんかズレる */}
      <div className="w-screen">
        <Router>
          <Routes>
            <Route path="/" element={<FriendScreen/>} />
            <Route path="/settings" element={<SettingsScreen updates={updates} />} />
            {isDev && <Route path="/debug" element={<DebugScreen />} />}
          </Routes>
        </Router>
      </div>
    </>
  );
}
