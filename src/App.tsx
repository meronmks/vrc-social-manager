import { useEffect, useRef, useState } from "react";
import { BrowserRouter, useLocation, useNavigate } from "react-router";
import { FiBell, FiChevronDown, FiLayers, FiSettings, FiTool, FiUsers } from "react-icons/fi";
import { ToastContainer, toast } from "react-toastify";
import { useAppUpdates } from "@/libs/useAppUpdates";
import LicensesScreen from "@/screens/licensesScreen";
import { UpdateConfirm } from "@/components/ui/dialogs/updateConfirm";
import { Avatar } from "@/components/ui/socialDetail";
import { SessionForm } from "@/components/ui/sessionForm";
import FriendScreen from "@/screens/friendScreen";
import SettingsScreen from "@/screens/settingsScreen";
import DebugScreen from "@/screens/debugScreen";
import { Account, clock, isExpired, Notice, session, useText } from "@/libs/social";
import { userDataStore } from "@/libs/userDataStore";
import { logging } from "@/libs/logging";
import "@/libs/i18n";

type Problem = { target?: Account; reason: string };
function Workspace() {
  const t = useText(),
    navigate = useNavigate(),
    { pathname } = useLocation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [active, setActive] = useState<Account>();
  const activeId = useRef<string | undefined>(undefined);
  const [epoch, setEpoch] = useState(0);
  const [auth, setAuth] = useState<{ target?: Account }>();
  const [menu, setMenu] = useState<"accounts" | "notices">();
  const [busy, setBusy] = useState(true);
  const [problem, setProblem] = useState<Problem>();
  const [history, setHistory] = useState<Record<string, Notice[]>>({});
  const updates = useAppUpdates(false);
  const accountLock = useRef(false);
  const popover = useRef<HTMLDivElement>(null);

  const generation = useRef(0);
  function didActivate(a: Account) {
    activeId.current = a.id;
    setActive(a);
    setAccounts((prev) => [a, ...prev.filter((u) => u.id !== a.id)]);
    setAuth(undefined);
    setMenu(undefined);
    setProblem(undefined);
    setEpoch(++generation.current);
    toast.dismiss();
    navigate("/");
  }
  async function switchAccount(a: Account) {
    if (accountLock.current) return;
    accountLock.current = true;
    setBusy(true);
    setMenu(undefined);
    setAuth(undefined);
    setProblem(undefined);
    try {
      didActivate(await session.switch(a.id));
    } catch (e) {
      setProblem({ target: a, reason: String(e) });
    } finally {
      accountLock.current = false;
      setBusy(false);
    }
  }
  async function boot(live: () => boolean) {
    setBusy(true);
    setProblem(undefined);
    try {
      const [list, id, theme] = await Promise.all([
        userDataStore.getUsers(),
        userDataStore.getCurrentUserId(),
        userDataStore.getTheme(),
      ]);
      if (!live()) return;
      document.documentElement.dataset.theme = theme;
      list.sort((a, b) => b.lastLogin.getTime() - a.lastLogin.getTime());
      setAccounts(list);
      const selected = list.find((u) => u.id === id) ?? list[0];
      if (selected) await switchAccount(selected);
      else {
        setAuth({});
        setBusy(false);
      }
    } catch {
      if (live()) {
        setProblem({ reason: "storage" });
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    let live = true;
    void boot(() => live);
    return () => {
      live = false;
    };
  }, []);
  function notifyFor(id: string, ja: string, en: string, error = false) {
    const notice = { time: Date.now(), ja, en, error };
    setHistory((prev) => ({ ...prev, [id]: [notice, ...(prev[id] ?? [])] }));
    if (error) void logging.error(ja).catch(() => {});
    if (activeId.current === id) {
      if (error) toast.error(t(ja, en), { autoClose: false, toastId: id + ja });
      else toast(t(ja, en), { pauseOnFocusLoss: false, pauseOnHover: false });
    }
  }
  function expired(id: string) {
    if (activeId.current === id && generation.current === epoch)
      setProblem({ target: active, reason: "http:401" });
  }
  async function logout() {
    if (!active || accountLock.current) return;
    const id = active.id;
    accountLock.current = true;
    setBusy(true);
    try {
      await session.logout(id);
      const rest = accounts.filter((u) => u.id !== id);
      setAccounts(rest);
      activeId.current = undefined;
      setActive(undefined);
      setAuth(undefined);
      setMenu(undefined);
      setProblem(undefined);
      setHistory((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.dismiss();
      navigate("/");
      if (rest[0]) {
        try {
          didActivate(await session.switch(rest[0].id));
        } catch (e) {
          setProblem({ target: rest[0], reason: String(e) });
        }
      } else setAuth({});
    } catch {
      setProblem({ target: active, reason: "storage" });
    } finally {
      accountLock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!popover.current?.contains(e.target as Node)) setMenu(undefined);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(undefined);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);

  const licenses = pathname === "/settings/licenses",
    settings = pathname === "/settings" || licenses,
    instances = pathname === "/instances";
  const gated = !!problem && (!active || (problem.target?.id === active.id && isExpired(problem.reason)));
  const notices = active ? (history[active.id] ?? []) : [];
  const tabs = [
    { url: "/", label: t("フレンド", "Friends"), icon: FiUsers },
    { url: "/instances", label: t("インスタンス", "Instances"), icon: FiLayers },
    { url: "/settings", label: t("設定", "Settings"), icon: FiSettings },
  ];
  if (import.meta.env.DEV && pathname === "/debug") return <DebugScreen />;
  return (
    <div className="social-app">
      <header className="app-header">
        <div className="branding">
          <span>
            <FiUsers />
          </span>
          VRC Social Manager
        </div>
        <div className="app-controls" ref={popover}>
          {updates.available && (
            <button
              className="quiet-action update-notice"
              disabled={updates.busy}
              onClick={() => void updates.showAvailable()}
            >
              {t("アップデートがあります", "Update available")}
            </button>
          )}
          {active && !auth && (
            <button
              className="icon-action"
              title={t("最近の通知", "Recent notifications")}
              aria-label={t("最近の通知", "Recent notifications")}
              aria-expanded={menu === "notices"}
              onClick={() => setMenu(menu === "notices" ? undefined : "notices")}
            >
              <FiBell />
            </button>
          )}
          {!!accounts.length && !auth && (
            <button
              className="account-trigger"
              disabled={busy}
              aria-expanded={menu === "accounts"}
              onClick={() => setMenu(menu === "accounts" ? undefined : "accounts")}
            >
              {active && <Avatar person={active} account={active.id} />}
              {active?.displayName ?? t("アカウントを選択", "Select account")}
              <FiChevronDown />
            </button>
          )}
          {menu === "accounts" && (
            <div className="popover">
              <h3>{t("アカウント", "Accounts")}</h3>
              {accounts.map((a) => (
                <button
                  disabled={busy}
                  key={a.id}
                  aria-current={active?.id === a.id}
                  onClick={() => void switchAccount(a)}
                >
                  <Avatar person={a} account={active?.id === a.id ? a.id : undefined} />
                  {a.displayName}
                  {active?.id === a.id && <small>{t("使用中", "Active")}</small>}
                </button>
              ))}
              <button
                onClick={() => {
                  setMenu(undefined);
                  setAuth({});
                }}
              >
                ＋ {t("アカウントを追加", "Add account")}
              </button>
            </div>
          )}
          {menu === "notices" && (
            <section className="popover">
              <h3>
                {t("最近の通知", "Recent notifications")} · {active?.displayName}
              </h3>
              {notices.length ? (
                notices.map((n, i) => (
                  <p key={i}>
                    <small>{clock(n.time)}</small> {t(n.ja, n.en)}
                  </p>
                ))
              ) : (
                <p>{t("通知はありません", "No notifications")}</p>
              )}
            </section>
          )}
        </div>
      </header>
      {busy && (
        <div role="status" className="busy-strip">
          {t("アカウントを確認中…", "Checking account…")}
        </div>
      )}
      {problem && !auth && (
        <div className="problem" role="alert">
          <strong>
            {problem.target?.displayName}　
            {isExpired(problem.reason)
              ? t("認証の有効期限が切れました", "Session expired")
              : t("アカウントを確認できませんでした", "Could not verify the account")}
          </strong>
          <button
            onClick={() => {
              if (isExpired(problem.reason)) {
                setAuth({ target: problem.target });
              } else if (problem.target) void switchAccount(problem.target);
              else void boot(() => true);
            }}
            disabled={busy}
          >
            {isExpired(problem.reason) ? t("再ログイン", "Sign in again") : t("再試行", "Retry")}
          </button>
          {!gated && <button onClick={() => setProblem(undefined)}>{t("閉じる", "Close")}</button>}
        </div>
      )}
      {auth && (
        <SessionForm
          key={auth.target?.id ?? "new"}
          target={auth.target}
          adding={!!accounts.length}
          onSuccess={didActivate}
          cancel={accounts.length ? () => setAuth(undefined) : undefined}
        />
      )}
      {active && (
        <div className="app-body" hidden={!!auth || gated || busy}>
          <nav className="social-nav">
            {tabs.map(({ url, icon: Icon, label }) => (
              <button
                key={url}
                aria-current={url === pathname || (url === "/settings" && licenses) ? "page" : undefined}
                onClick={() => navigate(url)}
              >
                <Icon />
                {label}
              </button>
            ))}
            {import.meta.env.DEV && (
              <button
                className="dev-link"
                title={t("開発ツール", "Development tools")}
                onClick={() => navigate("/debug")}
              >
                <FiTool />
              </button>
            )}
          </nav>
          <main className="social-main">
            <div hidden={settings} className="workspace-pane">
              <FriendScreen
                key={active.id + epoch}
                account={active}
                instances={instances}
                notify={(ja, en, error) => notifyFor(active.id, ja, en, error)}
                expire={() => expired(active.id)}
              />
            </div>
            {licenses && <LicensesScreen />}
            {settings && !licenses && (
              <SettingsScreen
                account={active}
                logout={() => void logout()}
                updates={updates}
              />
            )}
          </main>
        </div>
      )}
    </div>
  );
}
export default function App() {
  return (
    <>
      <ToastContainer />
      <UpdateConfirm.Root />
      <BrowserRouter>
        <Workspace />
      </BrowserRouter>
    </>
  );
}
