import { BrowserRouter, useLocation, useNavigate } from "react-router";
import { FiLayers, FiSettings, FiTool, FiUsers } from "react-icons/fi";
import { toast } from "react-toastify";
import { AppHeader } from "@/components/ui/appHeader";
import { AppToasts } from "@/components/ui/appToasts";
import { UpdateConfirm } from "@/components/ui/dialogs/updateConfirm";
import { SessionForm } from "@/components/ui/sessionForm";
import DebugScreen from "@/screens/debugScreen";
import FriendScreen from "@/screens/friendScreen";
import LicensesScreen from "@/screens/licensesScreen";
import SettingsScreen from "@/screens/settingsScreen";
import { AccountProblem, useAccounts } from "@/libs/useAccounts";
import { useAppUpdates } from "@/libs/useAppUpdates";
import { useNotices } from "@/libs/useNotices";
import { isExpired, useText } from "@/libs/social";
import "@/libs/i18n";

function Workspace() {
  const t = useText();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const updates = useAppUpdates(false);
  // アカウントが変わったら通知を消してホームへ戻す。
  function resetView() {
    toast.dismiss();
    navigate("/");
  }
  const accounts = useAccounts({
    onActivate: resetView,
    onForget: (id) => {
      notices.forget(id);
      resetView();
    },
  });
  const notices = useNotices(accounts.isActive);
  const { active, auth, busy, problem } = accounts;

  const licenses = pathname === "/settings/licenses";
  const settings = pathname === "/settings" || licenses;
  const tabs = [
    { url: "/", label: t("フレンド", "Friends"), icon: FiUsers },
    { url: "/instances", label: t("インスタンス", "Instances"), icon: FiLayers },
    { url: "/settings", label: t("設定", "Settings"), icon: FiSettings },
  ];
  if (import.meta.env.DEV && pathname === "/debug") return <DebugScreen />;
  return (
    <div className="social-app">
      <AppHeader
        // アカウントの切り替えやログイン画面の表示でメニューを閉じる。
        key={(active?.id ?? "") + (auth ? ":auth" : "")}
        updates={updates}
        accounts={accounts.accounts}
        active={active}
        busy={busy}
        authOpen={!!auth}
        notices={notices.of(active?.id)}
        onSwitch={(a) => void accounts.switchAccount(a)}
        onAddAccount={accounts.startAuth}
      />
      {busy && (
        <div role="status" className="busy-strip">
          {t("アカウントを確認中…", "Checking account…")}
        </div>
      )}
      {problem && !auth && (
        <ProblemBanner
          problem={problem}
          busy={busy}
          dismissible={!accounts.gated}
          resolve={accounts.resolveProblem}
          dismiss={accounts.dismissProblem}
        />
      )}
      {auth && (
        <SessionForm
          key={auth.target?.id ?? "new"}
          target={auth.target}
          adding={!!accounts.accounts.length}
          onSuccess={accounts.activate}
          cancel={accounts.accounts.length ? accounts.cancelAuth : undefined}
        />
      )}
      {active && (
        <div className="app-body" hidden={!!auth || accounts.gated || busy}>
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
            {/* 設定を開いている間もフレンド画面は破棄せず、取得済みの一覧と選択を保つ。 */}
            <div hidden={settings} className="workspace-pane">
              <FriendScreen
                key={active.id + accounts.epoch}
                account={active}
                instances={pathname === "/instances"}
                notify={(ja, en, error) => notices.notify(active.id, ja, en, error)}
                expire={() => accounts.expire(active.id)}
              />
            </div>
            {licenses && <LicensesScreen />}
            {settings && !licenses && (
              <SettingsScreen account={active} logout={() => void accounts.logout()} updates={updates} />
            )}
          </main>
        </div>
      )}
    </div>
  );
}

// アカウントを確認できなかった・認証が切れたときの帯。
function ProblemBanner(props: {
  problem: AccountProblem;
  busy: boolean;
  dismissible: boolean;
  resolve: () => void;
  dismiss: () => void;
}) {
  const t = useText();
  const expired = isExpired(props.problem.reason);
  return (
    <div className="problem" role="alert">
      <strong>
        {props.problem.target?.displayName}
        {expired
          ? t("認証の有効期限が切れました", "Session expired")
          : t("アカウントを確認できませんでした", "Could not verify the account")}
      </strong>
      <button onClick={props.resolve} disabled={props.busy}>
        {expired ? t("再ログイン", "Sign in again") : t("再試行", "Retry")}
      </button>
      {props.dismissible && <button onClick={props.dismiss}>{t("閉じる", "Close")}</button>}
    </div>
  );
}

export default function App() {
  return (
    <>
      <AppToasts />
      <UpdateConfirm.Root />
      <BrowserRouter>
        <Workspace />
      </BrowserRouter>
    </>
  );
}
