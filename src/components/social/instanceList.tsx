import { FiChevronDown } from "react-icons/fi";
import { Virtuoso } from "react-virtuoso";
import { Dropdown } from "@/components/ui/dropdown";
import { InstanceKind, InstanceScope, SortOrder } from "@/libs/friendView";
import { access, destination, instanceName, instanceNumber, Person, Place, Text, useText, where } from "@/libs/social";
import { WorldPhoto } from "./media";
import { PlaceFriends } from "./placeFriends";
import { Occupancy } from "./presence";
import { RegionFlag } from "./region";

function scopeOptions(t: Text): [InstanceScope, string][] {
  return [
    ["all", t("全フレンド", "All friends")],
    ["favorite", t("お気に入りから", "From favorites")],
    ["members", t("所属グループ", "My groups")],
  ];
}
function kindOptions(t: Text): [InstanceKind, string][] {
  return [
    ["all", t("すべて", "All")],
    ["group", t("グループ主催", "Group")],
    ["other", t("グループ以外", "Other")],
  ];
}

interface FiltersProps {
  scope: InstanceScope;
  kind: InstanceKind;
  /** 「お気に入りから」で選択中のグループ名 */
  groupLabel?: string;
  groupPicker: React.ReactNode;
  onScope: (scope: InstanceScope) => void;
  onKind: (kind: InstanceKind) => void;
}

// 折りたたみ式の絞り込み。閉じているときは選択中の条件を要約して表示する。
export function InstanceFilters({ scope, kind, groupLabel, groupPicker, onScope, onKind }: FiltersProps) {
  const t = useText();
  const scopes = scopeOptions(t);
  const kinds = kindOptions(t);
  const memberView = scope === "members";
  const summary = [
    scopes.find(([value]) => value === scope)?.[1],
    scope === "favorite" && groupLabel,
    !memberView && kinds.find(([value]) => value === kind)?.[1],
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <details className="instance-filters">
      <summary>
        <strong>{t("絞り込み", "Filters")}</strong>
        <span title={summary}>{summary}</span>
        <FiChevronDown aria-hidden="true" />
      </summary>
      <div className="select-row">
        <span aria-hidden="true">{t("探す対象", "Source")}</span>
        <Dropdown
          label={t("探す対象", "Source")}
          value={scope}
          options={scopes.map(([value, label]) => ({ value, label }))}
          onChange={onScope}
        />
      </div>
      {scope === "favorite" && groupPicker}
      {!memberView && (
        <div className="segmented" role="group" aria-label={t("インスタンス種別", "Instance type")}>
          {kinds.map(([value, label]) => (
            <button key={value} aria-pressed={kind === value} onClick={() => onKind(value)}>
              {label}
            </button>
          ))}
        </div>
      )}
    </details>
  );
}

interface ListProps {
  locations: string[];
  byPlace: Map<string, Person[]>;
  placeAt: (location: string) => Place | undefined;
  account: string;
  starred: Set<string>;
  friendsReady: boolean;
  busy: boolean;
  failed: boolean;
  sortOrder: SortOrder;
  onSort: (order: SortOrder) => void;
  selected?: string;
  onSelect: (location: string) => void;
  /** 一覧をスクロールさせる親要素（画面に見えているカードだけを描画するために使う） */
  scroller: HTMLElement | null;
}

// インスタンス一覧（件数と並び順、各カード、空のときの案内）。
// カードは仮想スクロールで見えている範囲だけを描画する。
export function InstanceList(props: ListProps) {
  const { locations, busy, failed } = props;
  const t = useText();
  return (
    <>
      <div className="instance-list-heading">
        <h4>
          {t("インスタンス", "Instances")} {locations.length || (!busy && !failed) ? locations.length : "—"}
        </h4>
        <Dropdown
          className="sort-dropdown"
          alignEnd
          label={t("並び順", "Sort order")}
          value={props.sortOrder}
          options={[
            { value: "friendCount" as SortOrder, label: t("フレンドが多い順", "Most friends first") },
            { value: "original" as SortOrder, label: t("取得順", "Fetch order") },
          ]}
          onChange={props.onSort}
        />
      </div>
      {props.scroller && locations.length > 0 && (
        <Virtuoso
          customScrollParent={props.scroller}
          data={locations}
          computeItemKey={(_, location) => location}
          defaultItemHeight={96}
          increaseViewportBy={600}
          itemContent={(_, location) => {
            const place = props.placeAt(location);
            const name = instanceName(place);
            return (
              <button
                className="place-row"
                aria-pressed={location === props.selected}
                onClick={() => props.onSelect(location)}
              >
                <WorldPhoto world={place?.world} account={props.account} compact />
                <strong>{where(location, place, t)}</strong>
                <Occupancy place={place} />
                <small className="instance-info">
                  {name && name + " · "}
                  {access(place, t)} · #{instanceNumber(destination(location)?.instanceId ?? "")}{" "}
                  <RegionFlag region={place?.region} /> {place?.groupName}
                </small>
                <PlaceFriends
                  friends={props.byPlace.get(location)}
                  account={props.account}
                  starred={props.starred}
                  friendsReady={props.friendsReady}
                />
              </button>
            );
          }}
        />
      )}
      {!locations.length && !busy && !failed && (
        <p className="empty-text">{t("表示するインスタンスはありません", "No matching instances")}</p>
      )}
    </>
  );
}
