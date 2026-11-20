import { useState } from "react";
import { toast } from "react-toastify";
import { logging } from "./logging";
import { Notice, useText } from "./social";

// アカウントごとの通知履歴。使用中のアカウントへの通知だけを Toast でも表示する。
export function useNotices(isActive: (id: string) => boolean) {
  const t = useText();
  const [history, setHistory] = useState<Record<string, Notice[]>>({});

  function notify(id: string, ja: string, en: string, error = false) {
    const notice = { time: Date.now(), ja, en, error };
    setHistory((prev) => ({ ...prev, [id]: [notice, ...(prev[id] ?? [])] }));
    if (error) void logging.error(ja).catch(() => {});
    if (!isActive(id)) return;
    if (error) toast.error(t(ja, en), { autoClose: false, toastId: id + ja });
    else toast(t(ja, en), { pauseOnFocusLoss: false, pauseOnHover: false });
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
