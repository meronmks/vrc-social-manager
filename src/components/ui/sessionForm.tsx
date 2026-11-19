import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiAlertTriangle } from "react-icons/fi";
import { Account, session, useText } from "@/libs/social";

interface Props {
  target?: Account;
  adding: boolean;
  onSuccess: (a: Account) => void;
  cancel?: () => void;
}
export function SessionForm({ target, adding, onSuccess, cancel }: Props) {
  const [loginId, setId] = useState(target?.loginId ?? "");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const t = useText();
  const { t: translate } = useTranslation();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    // 入力値は送信した時点でフォームから消す。
    if (method) setCode("");
    else setPassword("");
    try {
      const result = method
        ? await session.verify(code.trim())
        : await session.login(target?.id, loginId.trim(), password);
      if ("method" in result) {
        setMethod(result.method);
      } else onSuccess(result);
    } catch (err) {
      const reason = String(err);
      if (reason === "mismatch") {
        setMethod("");
        setPassword("");
        setError(
          t("選んだアカウントのログインIDを入力してください", "Please sign in to the selected account"),
        );
      } else if (reason === "expired") {
        setMethod("");
        setError(t("確認コードの入力期限が切れました。もう一度ログインしてください", "Verification expired. Please sign in again."));
      } else if (/http:(401|400)|^code$/.test(reason)) {
        setError(
          method
            ? t("確認コードを確認してください", "Check your verification code")
            : t("ログインIDとパスワードを確認してください", "Check your login ID and password"),
        );
      } else {
        if (method && reason !== "code") {
          setMethod("");
          setCode("");
        }
        setError(
          reason === "storage"
            ? t("認証情報を保存できませんでした", "Could not save the session")
            : t(
                "認証を完了できませんでした。もう一度お試しください",
                "Could not finish signing in. Try again.",
              ),
        );
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="auth-surface">
      <form className="auth-card" onSubmit={submit}>
        <h1>
          {target
            ? t(target.displayName + " に再ログイン", "Sign in again as " + target.displayName)
            : adding
              ? t("アカウントを追加", "Add account")
              : t("VRChatにログイン", "Sign in to VRChat")}
        </h1>
        <div className="login-notice" role="note">
          <FiAlertTriangle aria-hidden="true" />
          <div>
            <p>{translate("login.warnmes1")}</p>
            <p>{translate("login.warnmes2")}</p>
            <p>{translate("login.warnmes3")}</p>
          </div>
        </div>
        {method ? (
          <label>
            {method === "emailOtp"
              ? t("VRChatから届いたメールの確認コード", "Code from your VRChat email")
              : t("認証アプリに表示された確認コード", "Code from your authenticator")}
            <input
              autoFocus
              key="otp"
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        ) : (
          <>
            {target && (
              <p className="list-state">
                {target.loginId
                  ? t("認証の有効期限が切れました。", "Your session has expired.")
                  : t(
                      target.displayName + " のログインIDを入力してください。",
                      "Enter the login ID for " + target.displayName + ".",
                    )}
              </p>
            )}
            <label>
              {t("ユーザー名またはメールアドレス", "Username or email")}
              <input
                required
                autoFocus={!target?.loginId}
                autoComplete="username"
                readOnly={!!target?.loginId}
                value={loginId}
                onChange={(e) => setId(e.target.value)}
              />
            </label>
            <label>
              {t("パスワード", "Password")}
              <input
                autoFocus={!!target?.loginId}
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="list-state warn">
            {error}
          </p>
        )}
        <button className="primary-action" disabled={busy}>
          {busy
            ? t("認証中…", "Signing in…")
            : method
              ? t("確認", "Verify")
              : target
                ? t("再ログイン", "Sign in again")
                : t("ログイン", "Sign in")}
        </button>
        {(cancel || method) && (
          <button
            type="button"
            className="text-action"
            disabled={busy}
            onClick={async () => {
              await session.cancel();
              if (cancel) cancel();
              else {
                setMethod("");
                setCode("");
                setError("");
              }
            }}
          >
            {t("戻る", "Back")}
          </button>
        )}
      </form>
    </div>
  );
}
