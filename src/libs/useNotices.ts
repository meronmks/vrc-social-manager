import { useState } from "react";
import { toast } from "react-toastify";
import { logging } from "./logging";
import { describeFailure, Notice, useText } from "./social";

// アカウントごとの通知履歴。使用中のアカウントへの通知だけを Toast でも表示する。
// Toast はすべて自動で閉じ、見逃した通知はヘッダーの「最近の通知」から確認する。
export function useNotices(isActive: (id: string) => boolean) {
  const t = useText();
  const [history, setHistory] = useState<Record<string, Notice[]>>({});

  function notify(id: string, ja: string, en: string, error = false, cause?: unknown) {
    const notice = { time: Date.now(), ja, en, error };
    setHistory((prev) => ({ ...prev, [id]: [notice, ...(prev[id] ?? [])] }));
    // 原因が分かるときは、再試行すべきか別の対処が要るかを判断できるようログに添える。
    // 通信の詳細（どの要求が・どんな応答で）は、この直前に Rust 側が WARN で記録している。
    const detail = cause === undefined ? ja : `${ja}: ${describeFailure(cause)}`;
    if (error) void logging.error(detail).catch(() => {});
    if (!isActive(id)) return;
    // 履歴から見返せるため、エラーも自動で閉じる（同じエラーの重複表示だけ防ぐ）。
    if (error) toast.error(t(ja, en), { toastId: id + ja });
    else toast(t(ja, en));
  }

  function forget(id: string) {
    setHistory((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  return { of: (id?: string) => (id ? (history[id] ?? []) : []), notify, forget };
}
