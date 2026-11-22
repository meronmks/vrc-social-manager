import { useEffect, useRef, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import { InstanceCategory, InstanceVibe, isExpired, Phase, Place, request, Text, useText } from "@/libs/social";

interface Props {
  account: string;
  place: Place | undefined;
  expire: () => void;
}

// 権限の項目。並びは VRChat のワールド設定画面に合わせる。
// emoji などはインスタンス・ワールドの設定値、avatar_scaling・focus_view・third_person_view は
// ワールドのタグ（feature_*_disabled）、player_movement はアイテムの禁止機能（disabledPropAbilities）で決まる。
const PLAYER_MOVEMENT = "player_movement";
const PERMISSIONS: { key: string; label: (t: Text) => string }[] = [
  { key: "avatar_scaling", label: (t) => t("アバターのサイズ変更", "Avatar scaling") },
  { key: "emoji", label: (t) => t("絵文字", "Emoji") },
  { key: "stickers", label: (t) => t("ステッカー", "Stickers") },
  { key: "pedestals", label: (t) => t("ペデスタル", "Sharing pedestals") },
  { key: "prints", label: (t) => t("プリント", "Prints") },
  { key: "drones", label: (t) => t("ドローン", "Drones") },
  { key: "props", label: (t) => t("アイテム", "Items") },
  { key: PLAYER_MOVEMENT, label: (t) => t("プレイヤーの移動に影響するアイテム", "Items that modify player movement") },
  { key: "focus_view", label: (t) => t("フォーカスビュー（モバイル）", "Focus view (mobile)") },
  { key: "third_person_view", label: (t) => t("三人称視点", "Third-person view") },
];

// 権限が許可されているかを、インスタンスの設定 → ワールドの既定 → ワールドのタグの順に判定する。
// どれも取得できていなければ undefined（不明）を返す。
function permitted(place: Place, key: string): boolean | undefined {
  if (key === PLAYER_MOVEMENT) {
    // インスタンス作成時に変えられるため、インスタンスの値があればそれを優先する。
    const disabled = place.disabledPropAbilities ?? place.world?.disabledPropAbilities;
    return disabled ? !disabled.includes(PLAYER_MOVEMENT) : undefined;
  }
  const own = place.contentSettings?.[key];
  if (typeof own === "boolean") return own;
  const preset = place.world?.defaultContentSettings?.[key];
  if (typeof preset === "boolean") return preset;
  const tags = place.world?.tags;
  return tags ? !tags.includes(`feature_${key}_disabled`) : undefined;
}

type CatalogKind = "instanceCategories" | "instanceVibes";

// カテゴリ・バイブスの一覧を、必要になったときだけ取得する（Rust 側で保持するため2回目以降は通信しない）。
function useCatalog<K extends CatalogKind>(account: string, kind: K, enabled: boolean, expire: () => void) {
  const [items, setItems] = useState<(K extends "instanceCategories" ? InstanceCategory : InstanceVibe)[]>();
  const [phase, setPhase] = useState<Phase>("loading");
  const latestExpire = useRef(expire);
  latestExpire.current = expire;
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setPhase("loading");
    void request(account, { kind }).then(
      (result) => {
        if (!live) return;
        setItems(result as typeof items);
        setPhase("ready");
      },
      (e) => {
        if (!live) return;
        setPhase("failed");
        if (isExpired(e)) latestExpire.current();
      },
    );
    return () => {
      live = false;
    };
  }, [account, kind, enabled]);
  return { items, phase };
}

// 一覧から名前を引く。取得中・失敗時はその旨を、一覧にない ID はそのまま返す。
function catalogText(phase: Phase, names: (string | undefined)[], ids: string[], t: Text) {
  if (phase === "loading") return t("取得中…", "Loading…");
  if (phase === "failed") return t("取得できませんでした", "Could not load");
  return names.map((name, i) => name ?? ids[i]).join(" · ");
}

// インスタンスのカテゴリと雰囲気（バイブス）。設定されているものだけを常に表示する。
// API は ID だけを返すため、名前の一覧を取得して引き当てる（Rust 側で保持するため通信は初回のみ）。
export function PlaceTags({ account, place, expire }: Props) {
  const t = useText();
  const categoryId = place?.categoryId ?? undefined;
  // 代表の雰囲気を先頭に並べる。
  const vibeIds = [...(place?.vibeIds ?? [])].sort(
    (a, b) => Number(b === place?.displayVibeId) - Number(a === place?.displayVibeId),
  );
  const categories = useCatalog(account, "instanceCategories", !!categoryId, expire);
  const vibes = useCatalog(account, "instanceVibes", vibeIds.length > 0, expire);
  if (!categoryId && !vibeIds.length) return null;
  return (
    <dl className="place-tags">
      {categoryId && (
        <div>
          <dt>{t("カテゴリ", "Category")}</dt>
          <dd>
            {catalogText(
              categories.phase,
              [categories.items?.find((c) => c.id === categoryId)?.name],
              [categoryId],
              t,
            )}
          </dd>
        </div>
      )}
      {vibeIds.length > 0 && (
        <div>
          <dt>{t("雰囲気", "Vibes")}</dt>
          <dd>
            {catalogText(
              vibes.phase,
              vibeIds.map((id) => vibes.items?.find((v) => v.id === id)?.title),
              vibeIds,
              t,
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}

// インスタンス詳細の「その他の情報」。必要なときだけ見る情報を、普段は閉じておく。
export function InstanceExtras({ place }: Pick<Props, "place">) {
  const t = useText();
  if (!place) return null;
  const platforms = place.platforms;
  return (
    <details className="settings-box instance-extras">
      <summary>
        {t("その他の情報", "More info")}
        <FiChevronDown aria-hidden="true" />
      </summary>
      <section className="extras-description">
        <h4>{t("説明", "Description")}</h4>
        <p>{place.description?.trim() || t("なし", "None")}</p>
      </section>
      <div>
        <span>{t("年齢制限", "Age gate")}</span>
        <span>{place.ageGate == null ? "—" : place.ageGate ? t("あり", "On") : t("なし", "Off")}</span>
      </div>
      <div>
        <span>{t("プラットフォーム別の人数", "Users by platform")}</span>
        <span>
          {platforms
            ? `PC ${platforms.standalonewindows ?? 0} · Android ${platforms.android ?? 0} · iOS ${platforms.ios ?? 0}`
            : "—"}
        </span>
      </div>
      {place.closedAt && (
        <div>
          <span>{t("閉鎖", "Closed")}</span>
          <span>{new Date(place.closedAt).toLocaleString([], { hour12: false })}</span>
        </div>
      )}
      <h4>{t("権限", "Permissions")}</h4>
      {PERMISSIONS.map(({ key, label }) => {
        const allowed = permitted(place, key);
        return (
          <div key={key}>
            <span>{label(t)}</span>
            <span className={allowed === false ? "denied" : undefined}>
              {allowed === undefined ? "—" : allowed ? t("許可", "Allowed") : t("禁止", "Blocked")}
            </span>
          </div>
        );
      })}
    </details>
  );
}
