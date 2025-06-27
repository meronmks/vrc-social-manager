import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { commands } from "@/bindings";
import { useTranslation } from "react-i18next";
import i18n, { resources } from "@/libs/i18n";
import { Login } from "@/components/ui/dialogs/login";
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from "@tauri-apps/api/app";
import { toastError } from "@/components/toast";
import { ThirdPartyLicenses } from "@/components/ui/dialogs/license";
import { logging } from "@/libs/logging.tsx";
import { UpdateConfirm } from "@/components/ui/dialogs/updateConfirm";
import { userDataStore, UserData } from "@/libs/userDataStore";

export default function SettingsScreen() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [theme, setTheme] = useState("");
  const [users, setUsers] = useState<UserData[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [fetchFriendsCount, setFetchFriendsCount] = useState(50);
  const { t } = useTranslation();
  const supportedLangs = Object.keys(resources);
  const currentLang = i18n.language;
  const [loginUserName, setLoginUserName] = useState("unknown");
  const [currentVersion, setCurrentVersion] = useState("");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [autoCheckUpdates, setAutoCheckUpdates] = useState<boolean | null>(null);
  const [updateMessage, setUpdateMessage] = useState("");

  useEffect(() => {
    async function loadSettings() {
      const dataTheme = await userDataStore.getTheme();
      if (dataTheme) {
        setTheme(dataTheme);
      }

      const ffc = await userDataStore.getFetchFriendsCount();
      if (ffc) {
        setFetchFriendsCount(ffc);
      }

      // 自動アップデートの設定を読み込む
      const autoUpdate = await userDataStore.getAutoCheckUpdates();
      setAutoCheckUpdates(autoUpdate ?? true);

      // ユーザーデータの読み込み
      const savedUsers = await userDataStore.getUsers();
      setUsers(savedUsers);

      const currentId = await userDataStore.getCurrentUserId();
      if (currentId) {
        setCurrentUserId(currentId);
      }

      const res = await commands.verifyAuthToken();
      if (res.status == "ok") {
        setIsLoggedIn(res.data);
        getLoginUserName();
      } else {
        logout();
      }

      const version = await getVersion();
      setCurrentVersion(version);
    }
    loadSettings();
  }, []);

  useEffect(() => {
    if (theme == "") return;
    userDataStore.setTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (autoCheckUpdates === null) return;
    userDataStore.setAutoCheckUpdates(autoCheckUpdates);
  }, [autoCheckUpdates]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const logout = async () => {
    setIsLoggedIn(false);
    await commands.cookieClear();

    if (currentUserId) {
      await userDataStore.removeUser(currentUserId);
      setUsers(await userDataStore.getUsers());
    }

    setCurrentUserId(null);
  };

  const switchUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    await commands.cookieClear();
    await commands.switchUser(userId);

    await userDataStore.setCurrentUser(userId);
    setCurrentUserId(userId);

    setLoginUserName(user.displayName);
    setIsLoggedIn(true);
  };

  const langChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    i18n.changeLanguage(selected);
    userDataStore.setLanguage(selected);
  }

  const getLoginUserName = async () => {
    const res = await commands.getCurrentUserInfo();
    if (res.status == "ok") {
      const jsonData = JSON.parse(res.data);
      setLoginUserName(jsonData.displayName);

      await userDataStore.addOrUpdateUser(jsonData.id, jsonData.displayName, res.data);
      const updatedUsers = await userDataStore.getUsers();
      setUsers(updatedUsers);

      await userDataStore.setCurrentUser(jsonData.id);
      setCurrentUserId(jsonData.id);
    }
  }

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    getLoginUserName();
  };

  const handleNewAccountLogin = async () => {
    await commands.cookieClear(); // 現在のセッションをクリア
    Login.call({ onLoginSuccess: handleLoginSuccess })
  };

  const checkForUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateMessage("");
    try {
      await logging.info("Check for updates")
      const update = await check();
      if (update) {
        setUpdateMessage(t("settingScreen.updateAvailable", { version: update.version }));
        const releaseNote = await commands.getReleaseNote(update.version);
        const result = await UpdateConfirm.call({
          version: update.version,
          releaseNotes: releaseNote.status === "ok" ? JSON.parse(releaseNote.data).body : undefined,
        });
        if (result) {
          await update.downloadAndInstall()
          await relaunch()
        }
      } else {
        await logging.info("No updates available")
        setUpdateMessage(t("settingScreen.noUpdatesAvailable"));
      }
    } catch (error) {
      toastError("Update check failed: " + error);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-base-200 p-4 overflow-y-auto">
      <h1 className="text-xl font-semibold mb-4">{t("settings")}</h1>
      <h2 className="text-md font-semibold mb-4">{t("settingScreen.generalSettings")}</h2>
      <ul className="menu bg-base-100 p-2 rounded-box shadow-md w-full">
        <li>
          <div className="flex justify-between items-center w-full">
            <span>{t("language.title")}</span>
            <select value={currentLang} onChange={langChange} className="select select-bordered">
              {supportedLangs.map((lng) => (
                <option key={lng} value={lng}>
                  {t(`language.${lng}`, lng)}
                </option>
              ))}
            </select>
          </div>
        </li>
        <li>
          <div className="flex justify-between items-center w-full">
            <span>{t("settingScreen.theme")}</span>
            <button className="btn btn-sm" onClick={toggleTheme}>{t("settingScreen.switchTheme", { theme: theme === "light" ? "Dark" : "Light" })}</button>
          </div>
        </li>
        <li>
          <div className="flex justify-between items-center w-full">
            <span>{t("settingScreen.fetchFriendsCount")}</span>
            <input
              type="number"
              min="1"
              max="100"
              className="input input-bordered mt-2"
              placeholder="1-100"
              value={fetchFriendsCount}
              onChange={(e) => {
                const value = Number(e.target.value);
                setFetchFriendsCount(value);
                userDataStore.setFetchFriendsCount(value);
              }}
            />
          </div>
        </li>
      </ul>

      <h2 className="text-md font-semibold my-4">{t("settingScreen.accountSettings")}</h2>
      <ul className="menu bg-base-100 p-2 rounded-box shadow-md w-full">
        <li>
          {isLoggedIn ? (
            <div className="flex flex-col w-full gap-2">
              <div className="flex justify-between items-center w-full">
                <span>{t("settingScreen.loggedIn", { user: loginUserName })}</span>
                <div className="flex gap-2">
                  <button className="btn btn-sm btn-primary" onClick={handleNewAccountLogin}>
                    {t("settingScreen.addAccount")}
                  </button>
                  <button className="btn btn-sm btn-error" onClick={() => logout()}>
                    {t("settingScreen.logout")}
                  </button>
                </div>
              </div>
              {users.length > 1 && (
                <div className="flex justify-between items-center w-full">
                  <span>{t("settingScreen.switchToAccount")}</span>
                  <select
                      className="select select-bordered"
                      value={currentUserId ?? ""}
                      onChange={(e) => switchUser(e.target.value)}
                    >
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.displayName}
                        </option>
                      ))}
                    </select>
                </div>
              )}
            </div>) : (
            <div className="flex flex-col w-full gap-2">
              <div className="flex justify-between items-center w-full">
                <span>{t("settingScreen.loggedOut")}</span>
                <button className="btn btn-sm btn-primary" onClick={handleNewAccountLogin}>{t("settingScreen.login")}</button>
              </div>
              {users.length > 0 && (
                <div className="flex justify-between items-center w-full">
                  <span>{t("settingScreen.switchToAccount")}</span>
                  <select
                      className="select select-bordered"
                      value=""
                      onChange={(e) => switchUser(e.target.value)}
                    >
                      <option value="" disabled>{t("settingScreen.selectAccount")}</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.displayName}
                        </option>
                      ))}
                    </select>
                </div>
              )}
            </div>
          )}
        </li>
      </ul>

      <h2 className="text-md font-semibold my-4">{t("settingScreen.updateSettings")}</h2>
      <ul className="menu bg-base-100 p-2 rounded-box shadow-md w-full">
        <li>
          <div className="flex justify-between items-center w-full">
            <span>{t("settingScreen.currentVersion", { version: currentVersion })}</span>
          </div>
        </li>
        <li>
          <div className="flex justify-between items-center w-full">
            <span>{t("settingScreen.autoCheckUpdates")}</span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={autoCheckUpdates ?? true}
              onChange={(e) => setAutoCheckUpdates(e.target.checked)}
            />
          </div>
        </li>
        <li>
          <div className="flex justify-between items-center w-full">
            <div className="flex-1">
              <button
                className="btn btn-sm btn-primary"
                onClick={checkForUpdates}
                disabled={isCheckingUpdate}
              >
                {isCheckingUpdate ? t("settingScreen.checkingForUpdates") : t("settingScreen.checkForUpdatesNow")}
              </button>
              {updateMessage && (
                <div className="text-sm mt-2">{updateMessage}</div>
              )}
            </div>
          </div>
        </li>
      </ul>

      <h2 className="text-md font-semibold my-4">{t("settingScreen.thirdPartyLicenses")}</h2>
      <div className="bg-base-100 p-2 rounded-box shadow-md w-full">
        <ThirdPartyLicenses />
      </div>

      <button className="btn btn-outline mt-4" onClick={() => navigate("/")}>{t("settingScreen.backToHome")}</button>
    </div>
  );
}
