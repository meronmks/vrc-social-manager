// フレンド・インスタンス一覧の絞り込みと集計（表示に依存しない純粋な処理）。
import { destination, Favorite, FavoriteGroup, locationOf, Person, Place } from "./social";
import type { ViewKey } from "./useSocialData";

/** インスタンスを探す対象 */
export type InstanceScope = "all" | "favorite" | "members";
/** インスタンスの主催種別 */
export type InstanceKind = "all" | "group" | "other";
/** インスタンス一覧の並び順 */
export type SortOrder = "friendCount" | "original";
/** グループ選択で「全フレンド」を表す値 */
export const ALL_FRIENDS = "*";

export interface FavoriteGroupOption {
  name: string;
  label: string;
}

// 指定したお気に入りグループに入っているユーザーIDの集合。
export function favoriteIdsIn(favorites: Favorite[], group: string) {
  return new Set(favorites.filter((f) => f.tags.includes(group)).map((f) => f.favoriteId));
}

// 名前の比較に使う照合器。localeCompare を毎回呼ぶより速いため、一度だけ作って使い回す。
const nameOrder = new Intl.Collator().compare;

// フレンド一覧に出す人。検索中は全フレンドから名前で探し、それ以外は表示範囲（全員かグループ）で絞る。
// オンラインの人を先に、同じ状態の中では名前順に並べる。
export function visibleFriends(everyone: Person[], search: string, showAll: boolean, inGroup: Set<string>) {
  return everyone
    .filter((p) => (search ? p.displayName.toLocaleLowerCase().includes(search) : showAll || inGroup.has(p.id)))
    .sort((a, b) => Number(!!b.online) - Number(!!a.online) || nameOrder(a.displayName, b.displayName));
}

// オンラインのフレンドを、ワールドとインスタンスが分かる現在地ごとにまとめる。
// 自分（`me`）を渡すと、自分のいるインスタンスにも含める（その場所の先頭に置く）。
export function groupByPlace(everyone: Person[], me?: Person) {
  const byPlace = new Map<string, Person[]>();
  for (const person of me ? [me, ...everyone] : everyone) {
    if (!person.online) continue;
    const location = locationOf(person);
    if (!destination(location)) continue;
    const others = byPlace.get(location);
    if (others) others.push(person);
    else byPlace.set(location, [person]);
  }
  return byPlace;
}

function matchesKind(place: Place | undefined, kind: InstanceKind) {
  if (kind === "all") return true;
  if (kind === "group") return place?.type === "group";
  return Boolean(place?.type && place.type !== "group");
}

// インスタンス一覧に出す場所。所属グループの一覧はそのまま、フレンドの現在地は対象と種別で絞る。
export function visibleLocations(options: {
  scope: InstanceScope;
  kind: InstanceKind;
  sortOrder: SortOrder;
  members: string[];
  byPlace: Map<string, Person[]>;
  inGroup: Set<string>;
  placeAt: (location: string) => Place | undefined;
  /** 自分の現在地。一覧に含まれていれば、並び順にかかわらず先頭に置く */
  selfLocation?: string;
}) {
  const { scope, kind, sortOrder, members, byPlace, inGroup, placeAt, selfLocation } = options;
  const locations =
    scope === "members"
      ? [...members]
      : [...byPlace.keys()].filter((location) => {
          if (scope === "favorite" && !byPlace.get(location)?.some((f) => inGroup.has(f.id))) return false;
          return matchesKind(placeAt(location), kind);
        });
  if (sortOrder === "friendCount") {
    locations.sort((a, b) => (byPlace.get(b)?.length ?? 0) - (byPlace.get(a)?.length ?? 0));
  }
  const self = selfLocation ? locations.indexOf(selfLocation) : -1;
  if (self > 0) locations.unshift(...locations.splice(self, 1));
  return locations;
}

// 表示中の一覧の種類。取得状況と最終確認時刻はこの単位で扱う。
export function viewKeyOf(instances: boolean, scope: InstanceScope, broadSearch: boolean): ViewKey {
  if (instances) return scope === "members" ? "members" : scope === "favorite" ? "favoritePlaces" : "allPlaces";
  return broadSearch ? "search" : "home";
}

// お気に入りグループの表示名。ゲーム内で名前を付けていない標準枠は `Group 1` のように表示する。
export function favoriteGroupOptions(groups: FavoriteGroup[], friendGroupNames?: string[]): FavoriteGroupOption[] {
  return groups.map((g, index) => {
    const slot = /^group_(\d+)$/.exec(g.name);
    const number = slot ? Number(slot[1]) : index;
    const names = [g.displayName, slot ? friendGroupNames?.[number] : g.name];
    const label = names.map((name) => name?.trim()).find((name) => name && name !== slot?.[0]);
    return { name: g.name, label: label || `Group ${number + 1}` };
  });
}
