import { useRef, useState } from "react";
import { FiSend } from "react-icons/fi";
import { Account, isExpired, Notify, request, useText } from "@/libs/social";

type InviteState = "idle" | "sending" | "sent" | "unknown" | "failed";

// 4xx（タイムアウトの 408 を除く）は送信されなかったと判断できる。それ以外は届いたか不明として扱う。
function isDefinitiveFailure(error: unknown) {
  const reason = String(error);
  return /^http:4\d\d$/.test(reason) && reason !== "http:408";
}

// 使用中のアカウントに、指定したインスタンスへの招待を送るボタン。
export function SelfInvite({
  account,
  location,
  notify,
  expire,
}: {
  account: Account;
  location: string;
  notify: Notify;
  expire: () => void;
}) {
  const [state, setState] = useState<InviteState>("idle");
  const lock = useRef(false);
  const t = useText();
  async function send() {
    if (lock.current) return;
    lock.current = true;
    setState("sending");
    try {
      await request(account.id, { kind: "invite", location });
      setState("sent");
      notify("自分に招待を送りました", "Invitation sent to yourself");
    } catch (e) {
      if (isExpired(e)) expire();
      const definitive = isDefinitiveFailure(e);
      setState(definitive ? "failed" : "unknown");
      if (definitive) notify("招待を送れませんでした", "Could not send the invitation", true);
      else notify("送信結果を確認できませんでした", "Could not confirm delivery");
    } finally {
      lock.current = false;
    }
  }
  const buttonLabel = {
    idle: t("自分に招待を送る", "Invite myself"),
    sending: t("送信中…", "Sending…"),
    sent: t("自分に招待を送りました", "Invitation sent"),
    unknown: t("再送", "Send again"),
    failed: t("再送", "Send again"),
  }[state];
  return (
    <section className="invite">
      {(state === "unknown" || state === "failed") && (
        <p role="status">
          {state === "unknown"
            ? t("送信結果を確認できませんでした", "Could not confirm delivery")
            : t("招待を送れませんでした", "Could not send the invitation")}
        </p>
      )}
      <button
        className={state === "idle" ? "primary-action" : "quiet-action"}
        onClick={send}
        disabled={state === "sending" || state === "sent"}
      >
        <FiSend />
        {buttonLabel}
      </button>
    </section>
  );
}
