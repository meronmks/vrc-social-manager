import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { ThirdPartyLicenses } from "@/components/ui/dialogs/license";
import { Account, useText } from "@/libs/social";
import { userDataStore } from "@/libs/userDataStore";
import i18n from "@/libs/i18n";

interface Props {
  account: Account;
  logout: () => void;
  checkUpdate: () => Promise<void>;
  checking: boolean;
  updateStatus: string;
}
export default function SettingsScreen({ account, logout, checkUpdate, checking, updateStatus }: Props) {
  const [theme, setTheme] = useState("light");
  const [auto, setAuto] = useState(true);
  const [count, setCount] = useState("50");
  const [version, setVersion] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const t = useText();
  useEffect(() => {
    let live = true;
    Promise.all([
      userDataStore.getTheme(),
      userDataStore.getAutoCheckUpdates(),
      userDataStore.getFetchFriendsCount(),
      getVersion(),
    ])
      .then(([v, a, c, version]) => {
        if (live) {
          setTheme(v);
          setAuto(a);
          setCount(String(c));
          setVersion(version);
          setReady(true);
        }
      })
      .catch(() => setError(true));
    return () => {
      live = false;
    };
  }, []);
  async function save(fn: () => Promise<unknown>) {
    try {
      await fn();
      setError(false);
    } catch {
      setError(true);
    }
  }
  function saveCount() {
    const n = Number(count);
    if (!/^\d+$/.test(count) || !Number.isInteger(n) || n < 1 || n > 100) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    void save(() => userDataStore.setFetchFriendsCount(n));
  }
  return (
    <section className="settings-page">
      <h1>{t("設定", "Settings")}</h1>
      {error && <p role="alert">{t("設定を読み書きできませんでした", "Could not read or save settings")}</p>}
      <fieldset disabled={!ready}>
        <h3>{t("表示", "Display")}</h3>
        <div className="settings-box">
          <label>
            {t("表示言語", "Language")}
            <select
              value={i18n.language.startsWith("en") ? "en" : "ja"}
              onChange={(e) => {
                const lang = e.target.value;
                void save(async () => {
                  await userDataStore.setLanguage(lang);
                  await i18n.changeLanguage(lang);
                });
              }}
            >
              <option value="ja">日本語</option>
              <option value="en">English</option>
            </select>
          </label>
          <div>
            {t("テーマ", "Theme")}
            <span className="segmented">
              {["light", "dark"].map((v) => (
                <button
                  key={v}
                  aria-pressed={theme === v}
                  onClick={() =>
                    void save(async () => {
                      await userDataStore.setTheme(v);
                      setTheme(v);
                      document.documentElement.dataset.theme = v;
                    })
                  }
                >
                  {v === "light" ? t("ライト", "Light") : t("ダーク", "Dark")}
                </button>
              ))}
            </span>
          </div>
        </div>
        <h3>{t("アカウント", "Account")}</h3>
        <div className="settings-box">
          <div>
            <span>
              {t("使用中", "Active")}　<strong>{account.displayName}</strong>
            </span>
            <button className="quiet-action" onClick={logout}>
              {t("ログアウト", "Log out")}
            </button>
          </div>
        </div>
        <h3>{t("アプリの更新", "App updates")}</h3>
        <div className="settings-box">
          <label>
            {t("起動時にアプリの更新を確認", "Check for updates on startup")}
            <input
              className="toggle"
              type="checkbox"
              checked={auto}
              onChange={(e) => {
                const v = e.target.checked;
                void save(async () => {
                  await userDataStore.setAutoCheckUpdates(v);
                  setAuto(v);
                });
              }}
            />
          </label>
          <div>
            <span>
              {t("現在のバージョン", "Current version")}　{version}
            </span>
            <button className="quiet-action" disabled={checking} onClick={() => void checkUpdate()}>
              {checking ? t("確認中…", "Checking…") : t("今すぐ確認", "Check now")}
            </button>
          </div>
          {updateStatus && <p role="status">{updateStatus}</p>}
        </div>
        <h3>{t("詳細設定", "Advanced")}</h3>
        <details className="settings-box">
          <summary>{t("フレンド一覧の取得設定", "Friend list settings")}</summary>
          <label>
            {t("1回の通信で取得するフレンド数", "Friends per request")}
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={count}
              aria-invalid={invalid}
              onChange={(e) => {
                setCount(e.target.value);
                setInvalid(false);
              }}
              onBlur={saveCount}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </label>
          <p className={invalid ? "form-error" : ""}>
            {invalid
              ? t("1〜100の整数を入力してください", "Enter a whole number from 1 to 100")
              : t(
                  "1〜100人で指定できます。次回の一覧取得から適用します。",
                  "Enter 1–100. Applies to the next refresh.",
                )}
          </p>
        </details>
        <h3>{t("このアプリについて", "About")}</h3>
        <div className="settings-box">
          <button onClick={() => ThirdPartyLicenses.call({})}>
            {t("サードパーティライセンス", "Third-party licenses")}　›
          </button>
        </div>
      </fieldset>
    </section>
  );
}
