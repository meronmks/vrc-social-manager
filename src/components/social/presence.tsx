import { Place, useText } from "@/libs/social";

// オンライン状態の丸とラベル。本人のステータスメッセージがあればそちらを優先して表示する。
export function Presence({ status, description }: { status?: string; description?: string }) {
  const t = useText();
  const names: Record<string, string> = {
    "join me": t("合流歓迎", "Join me"),
    active: t("オンライン", "Online"),
    busy: t("取り込み中", "Busy"),
    "ask me": t("先に聞いて", "Ask me"),
    offline: t("オフライン", "Offline"),
  };
  const standard = names[status ?? ""] ?? t("状態不明", "Unknown");
  const label = description?.trim() || standard;
  return (
    <span className="presence" data-status={status} title={label === standard ? standard : `${standard} · ${label}`}>
      <i aria-hidden="true" />
      {label !== standard && <span className="sr-only">{standard}　</span>}
      <span className="presence-label">{label}</span>
    </span>
  );
}

// インスタンスの現在人数・定員と、入場待ちの人数。
export function Occupancy({ place }: { place?: Place }) {
  const t = useText();
  return (
    <span className="occupancy">
      {t("全体", "Total")} {place?.userCount ?? "—"}／{place?.capacity ?? "—"}
      {t("人", "")}
      {place?.queueEnabled && (place.queueSize ?? 0) > 0 && (
        <small>
          {place.queueSize}
          {t("人待ち", " waiting")}
        </small>
      )}
    </span>
  );
}
