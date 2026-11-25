import { FiBell, FiChevronDown, FiPlus, FiUsers } from "react-icons/fi";
import { Avatar } from "@/components/social/media";
import { NoticeIcon } from "@/components/ui/appToasts";
import { Account, clock, Notice, useText } from "@/libs/social";
import type { AppUpdates } from "@/libs/useAppUpdates";
import { usePopover } from "@/libs/usePopover";

interface Props {
  updates: AppUpdates;
  accounts: Account[];
  active?: Account;
  busy: boolean;
  /** ログイン画面の表示中は通知とアカウントの操作を隠す */
  authOpen: boolean;
  notices: Notice[];
  onSwitch: (account: Account) => void;
  onAddAccount: () => void;
}

// アプリ上部のバー。更新通知、最近の通知、アカウントの切り替えを置く。
export function AppHeader({ updates, accounts, active, busy, authOpen, notices, onSwitch, onAddAccount }: Props) {
  const t = useText();
  const menu = usePopover<"accounts" | "notices">();
  return (
    <header className="app-header">
      <div className="branding">
        <span>
          <FiUsers />
        </span>
        VRC Social Manager
      </div>
      <div className="app-controls" ref={menu.container}>
        {updates.available && (
          <button
            className="quiet-action update-notice"
            disabled={updates.busy}
            onClick={() => void updates.showAvailable()}
          >
            {t("アップデートがあります", "Update available")}
          </button>
        )}
        {active && !authOpen && (
          <button
            className="icon-action"
            title={t("最近の通知", "Recent notifications")}
            aria-label={t("最近の通知", "Recent notifications")}
            aria-expanded={menu.open === "notices"}
            onClick={() => menu.toggle("notices")}
          >
            <FiBell />
          </button>
        )}
        {!!accounts.length && !authOpen && (
          <button
            className="account-trigger"
            disabled={busy}
            aria-expanded={menu.open === "accounts"}
            onClick={() => menu.toggle("accounts")}
          >
            {active && <Avatar person={active} account={active.id} />}
            {active?.displayName ?? t("アカウントを選択", "Select account")}
            <FiChevronDown />
          </button>
        )}
        {menu.open === "accounts" && (
          <div className="popover">
            <h3>{t("アカウント", "Accounts")}</h3>
            {accounts.map((a) => (
              <button
                disabled={busy}
                key={a.id}
                aria-current={active?.id === a.id}
                onClick={() => {
                  menu.close();
                  onSwitch(a);
                }}
              >
                <Avatar person={a} account={active?.id === a.id ? a.id : undefined} />
                {a.displayName}
                {active?.id === a.id && <small>{t("使用中", "Active")}</small>}
              </button>
            ))}
            <button
              onClick={() => {
                menu.close();
                onAddAccount();
              }}
            >
              <FiPlus aria-hidden="true" />
              {t("アカウントを追加", "Add account")}
            </button>
          </div>
        )}
        {menu.open === "notices" && (
          <section className="popover">
            <h3>{t("最近の通知", "Recent notifications")}</h3>
            {notices.length ? (
              <ul className="notice-list">
                {notices.map((n, i) => (
                  <li key={i} data-error={n.error || undefined}>
                    <NoticeIcon error={n.error} />
                    <span>{t(n.ja, n.en)}</span>
                    <small>{clock(n.time)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="notice-empty">{t("通知はありません", "No notifications")}</p>
            )}
          </section>
        )}
      </div>
    </header>
  );
}
