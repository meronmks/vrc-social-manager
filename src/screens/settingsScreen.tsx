import { useEffect, useState } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import { getVersion } from "@tauri-apps/api/app";
import { useTranslation } from "react-i18next";
import type { AppUpdates } from "@/libs/useAppUpdates";
import { useNavigate } from "react-router";
import { Dropdown } from "@/components/ui/dropdown";
import { Account, useText } from "@/libs/social";
import { cacheLimits, userDataStore } from "@/libs/userDataStore";
import { commands } from "@/bindings";
import i18n from "@/libs/i18n";

interface Props {
  account: Account;
  logout: () => void;
  updates: AppUpdates;
}
// 0〜max の整数を入力し、確定したとき（フォーカスが外れたとき）に保存する入力欄。
function WholeNumberSetting(props: {
  label: string;
  value: number;
  max: number;
  help: string;
  onSave: (value: number) => Promise<void>;
}) {
  const { label, value, max, help, onSave } = props;
  const [text, setText] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  const t = useText();
  useEffect(() => setText(String(value)), [value]);
  function commit() {
    const n = Number(text);
    if (!/^\d+$/.test(text) || n > max) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (n !== value) void onSave(n);
  }
  return (
    <>
      <label>
        {label}
        <input
          type="number"
          min={0}
          max={max}
          step={1}
          value={text}
          aria-invalid={invalid}
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
      <p className={invalid ? "form-error" : ""}>
        {invalid ? t(`0〜${max}の整数を入力してください`, `Enter a whole number from 0 to ${max}`) : help}
      </p>
    </>
  );
}

export default function SettingsScreen({ account, logout, updates }: Props) {
  const [theme, setTheme] = useState("light");
  const [auto, setAuto] = useState(true);
  const [count, setCount] = useState("50");
  const [imageLimit, setImageLimit] = useState<number>(cacheLimits.image.fallback);
  const [lifetime, setLifetime] = useState<number>(cacheLimits.lifetime.fallback);
  const [purged, setPurged] = useState(false);
  const [version, setVersion] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const t = useText();
  const { t: translate } = useTranslation();
  const navigate = useNavigate();
  useEffect(() => {
    let live = true;
    Promise.all([
      userDataStore.getTheme(),
      userDataStore.getAutoCheckUpdates(),
      userDataStore.getFetchFriendsCount(),
      userDataStore.getImageCacheLimit(),
      userDataStore.getCacheLifetime(),
      getVersion(),
    ])
      .then(([v, a, c, image, hours, version]) => {
        if (live) {
          setTheme(v);
          setAuto(a);
          setCount(String(c));
          setImageLimit(image);
          setLifetime(hours);
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
      {error && <p role="alert">{t("設定を読み書きできませんでした", "Could not read or save settings")}</p>}
      <fieldset disabled={!ready}>
        <h3>{t("表示", "Display")}</h3>
        <div className="settings-box">
          <div>
            <span aria-hidden="true">{t("表示言語", "Language")}</span>
            <Dropdown
              alignEnd
              label={t("表示言語", "Language")}
              value={i18n.language.startsWith("en") ? "en" : "ja"}
              options={[
                { value: "ja", label: "日本語" },
                { value: "en", label: "English" },
              ]}
              onChange={(lang) =>
                void save(async () => {
                  await userDataStore.setLanguage(lang);
                  await i18n.changeLanguage(lang);
                })
              }
            />
          </div>
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
              {t("使用中のアカウント", "Signed in as")} <strong>{account.displayName}</strong>
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
              className="switch"
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
          <label>
            {translate("settingScreen.betaUpdates")}
            <input
              className="switch"
              type="checkbox"
              checked={updates.beta === true}
              disabled={updates.busy || updates.beta === null}
              aria-describedby="beta-updates-help"
              onChange={(e) => void updates.changeBeta(e.target.checked)}
            />
          </label>
          <p id="beta-updates-help">{translate("settingScreen.betaUpdatesHelp")}</p>
          <div>
            <span>
              {t("現在のバージョン", "Current version")} <strong>{version}</strong>
            </span>
            <button className="quiet-action" disabled={updates.busy} onClick={() => void updates.checkNow()}>
              {updates.busy ? t("確認中…", "Checking…") : t("今すぐ確認", "Check now")}
            </button>
          </div>
          {updates.message && <p role="status">{updates.message}</p>}
        </div>
        <h3>{t("詳細設定", "Advanced")}</h3>
        <details className="settings-box">
          <summary>
            {t("フレンド一覧の取得設定", "Friend list settings")}
            <FiChevronDown aria-hidden="true" />
          </summary>
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
        <details className="settings-box">
          <summary>
            {t("キャッシュの上限", "Cache limits")}
            <FiChevronDown aria-hidden="true" />
          </summary>
          <WholeNumberSetting
            label={t("画像キャッシュの上限（MB）", "Image cache limit (MB)")}
            value={imageLimit}
            max={cacheLimits.image.max}
            help={t(
              `0〜${cacheLimits.image.max}MBで指定できます。0にすると画像をキャッシュしません。`,
              `Enter 0–${cacheLimits.image.max} MB. 0 turns off image caching.`,
            )}
            onSave={(mb) =>
              save(async () => {
                await userDataStore.setImageCacheLimit(mb);
                setImageLimit(mb);
              })
            }
          />
          <WholeNumberSetting
            label={t("ワールド・グループ情報の保持時間（時間）", "Keep world and group info (hours)")}
            value={lifetime}
            max={cacheLimits.lifetime.max}
            help={t(
              `0〜${cacheLimits.lifetime.max}時間で指定できます。0にするとキャッシュしません。`,
              `Enter 0–${cacheLimits.lifetime.max} hours. 0 turns off caching.`,
            )}
            onSave={(hours) =>
              save(async () => {
                await userDataStore.setCacheLifetime(hours);
                setLifetime(hours);
              })
            }
          />
          <div>
            <span>{t("保持しているキャッシュ", "Cached data")}</span>
            <button
              className="quiet-action"
              onClick={() =>
                void save(async () => {
                  setPurged(false);
                  await commands.cachePurge();
                  setPurged(true);
                })
              }
            >
              {t("キャッシュを削除", "Clear cache")}
            </button>
          </div>
          <p role="status">
            {purged
              ? t("キャッシュを削除しました", "Cache cleared")
              : t(
                  "画像・ワールド・グループ情報のキャッシュを削除します。次回の表示から取得し直します。",
                  "Clears cached images, worlds, and groups. They will be fetched again when shown.",
                )}
          </p>
        </details>
        <h3>{t("このアプリについて", "About")}</h3>
        <div className="settings-box">
          <button onClick={() => navigate("/settings/licenses", { state: { fromSettings: true } })}>
            {t("サードパーティライセンス", "Third-party licenses")}
            <FiChevronRight aria-hidden="true" />
          </button>
        </div>
      </fieldset>
    </section>
  );
}
