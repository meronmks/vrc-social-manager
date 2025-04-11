import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { LazyStore } from '@tauri-apps/plugin-store';
import { commands } from "@/bindings";
import { useTranslation } from "react-i18next";
import i18n, { resources } from "@/libs/i18n";
import { Login } from "@/components/ui/dialogs/login";

export default function SettingsScreen() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [theme, setTheme] = useState("");
  const store = new LazyStore('store.json');
  const [fetchFriendsCount, setFetchFriendsCount] = useState(50);
  const { t } = useTranslation();
  const supportedLangs = Object.keys(resources);
  const currentLang = i18n.language;
  const [loginUserName, setLoginUserName] = useState("unknown");

  useEffect(() => {
    async function loadTheme() {
      const dataTheme = await store.get<string>("data-theme");
      if (dataTheme) {
        setTheme(dataTheme);
      }

      const ffc = await store.get<number>("fetch-friends-count");
      if (ffc) {
        setFetchFriendsCount(ffc);
      }

      const res = await commands.verifyAuthToken();
      if (res.status == "ok") {
        setIsLoggedIn(res.data);
        getLoginUserName();
      } else {
        logout();
      }
    }
    loadTheme();
  }, []);

  useEffect(() => {
    if (theme == "") return;
    store.set('data-theme', theme).then(() => store.save());
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const logout = () => {
    setIsLoggedIn(false);
    commands.cookieClear();
  };

  const langChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    i18n.changeLanguage(selected);
    store.set("lang", selected).then(() => store.save());
  }

  const getLoginUserName = async () => {
    const res = await commands.getCurrentUserInfo();
    if (res.status == "ok") {
      const jsonData = JSON.parse(res.data);
      setLoginUserName(jsonData.displayName);
    }
  }

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    getLoginUserName();
  };

  return (
    <div className="flex flex-col h-screen bg-base-200 p-4">
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
            <button className="btn btn-sm" onClick={toggleTheme}>{t("settingScreen.switchTheme", {theme: theme === "light" ? "Dark" : "Light"})}</button>
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
                store.set("fetch-friends-count", value).then(() => store.save());
              }}
            />
          </div>
        </li>
      </ul>

      <h2 className="text-md font-semibold my-4">{t("settingScreen.accountSettings")}</h2>
      <ul className="menu bg-base-100 p-2 rounded-box shadow-md w-full">
        <li>
          {isLoggedIn ? (
              <div className="flex justify-between items-center w-full">
                <span>{t("settingScreen.loggedIn", {user: loginUserName})}</span>
                <button className="btn btn-sm btn-error" onClick={() => {logout()}}>{t("settingScreen.logout")}</button>
              </div>
          ) : (
              <div className="flex justify-between items-center w-full">
                <span>{t("settingScreen.loggedOut")}</span>
                <button className="btn btn-sm btn-primary" onClick={() => Login.call({ onLoginSuccess: handleLoginSuccess })}>{t("settingScreen.login")}</button>
              </div>
          )}
        </li>
      </ul>
      <button className="btn btn-outline mt-4" onClick={() => navigate("/")}>{t("settingScreen.backToHome")}</button>
    </div>
  );
}
