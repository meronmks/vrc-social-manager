import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { FiRefreshCw, FiSearch, FiX } from "react-icons/fi";
import { useNavigate } from "react-router";
import { FriendList } from "@/components/social/friendList";
import { GroupPicker } from "@/components/social/groupPicker";
import { InstanceFilters, InstanceList } from "@/components/social/instanceList";
import { PlaceFriends } from "@/components/social/placeFriends";
import { SocialDetail } from "@/components/social/socialDetail";
import {
  ALL_FRIENDS,
  favoriteGroupOptions,
  favoriteIdsIn,
  groupByPlace,
  InstanceKind,
  InstanceScope,
  SortOrder,
  viewKeyOf,
  visibleFriends,
  visibleLocations,
} from "@/libs/friendView";
import { Account, clock, locationOf, Notify, useText } from "@/libs/social";
import { useSocialData, viewSources } from "@/libs/useSocialData";

interface Props {
  account: Account;
  /** true ならインスタンス一覧、false ならフレンド一覧を表示する */
  instances: boolean;
  notify: Notify;
  expire: () => void;
}

// フレンドとインスタンスのタブ。同じ取得データを共有し、タブを切り替えても検索や選択を保つ。
export default function FriendScreen({ account, instances, notify, expire }: Props) {
  const data = useSocialData(account.id, notify, expire);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<InstanceScope>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("friendCount");
  const [kind, setKind] = useState<InstanceKind>("all");
  const [selectedPerson, selectPerson] = useState("");
  const [instanceSelection, setInstanceSelection] = useState<{ location: string; friendId?: string }>();
  // フレンド詳細から移動してきたとき、インスタンス一覧をそのカードまでスクロールさせる
  const [reveal, setReveal] = useState<string>();
  // 一覧のスクロール領域。仮想スクロールはこの要素のスクロール位置に合わせて行を描画する。
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const t = useText();
  const navigate = useNavigate();
  const clearReveal = useCallback(() => setReveal(undefined), []);

  // フレンドが数千人いても軽く動くよう、絞り込みや並べ替えは元データが変わったときだけやり直す。
  // 検索語は入力を優先し、一覧の絞り込みは少し遅れて反映する。
  const search = useDeferredValue(query.trim().toLocaleLowerCase());
  const { favorites, group, friends, me, showAll, members, placeAt } = data;
  const starred = useMemo(() => new Set(favorites.map((f) => f.favoriteId)), [favorites]);
  const inGroup = useMemo(() => favoriteIdsIn(favorites, group), [favorites, group]);
  const everyone = useMemo(() => Object.values(friends), [friends]);
  const people = useMemo(
    () => (instances ? [] : visibleFriends(everyone, search, showAll, inGroup)),
    [instances, everyone, search, showAll, inGroup],
  );
  // インスタンス一覧では自分も参加者に含め、自分のいるインスタンスを常に先頭に置く。
  const self = me?.online ? me : undefined;
  const selfLocation = self && locationOf(self);
  const byPlace = useMemo(() => groupByPlace(everyone, self), [everyone, self]);
  const listOptions = { scope, kind, sortOrder, members, byPlace, inGroup, placeAt, selfLocation };
  const locations = useMemo(
    () =>
      instances
        ? visibleLocations({ scope, kind, sortOrder, members, byPlace, inGroup, placeAt, selfLocation })
        : [],
    [instances, scope, kind, sortOrder, members, byPlace, inGroup, placeAt, selfLocation],
  );
  const groups = useMemo(
    () => favoriteGroupOptions(data.groups, account.friendGroupNames),
    [data.groups, account.friendGroupNames],
  );

  const view = viewKeyOf(instances, scope, !!search || data.showAll);
  const sources = viewSources[view];
  const failed = sources.some((s) => data.phases[s] === "failed");
  const busy = sources.some((s) => data.phases[s] === "loading");
  const checked = data.checked[view];
  const friendsReady = data.phases.friends === "ready";

  // 詳細パネルの対象。インスタンス一覧ではインスタンス内のフレンドを開いても元の場所に戻れるようにする。
  const origin = instances ? instanceSelection?.location : undefined;
  const person = instances
    ? data.friends[instanceSelection?.friendId ?? ""]
    : people.find((p) => p.id === selectedPerson);
  const location = person ? undefined : origin;
  function clearSelection() {
    selectPerson("");
    setInstanceSelection(undefined);
    setReveal(undefined);
  }
  // フレンドの現在地のインスタンスを、インスタンス一覧で選択して表示する。
  // 今の絞り込みでは一覧に出ない場合は、絞り込みを「全フレンド・すべて」に戻して一覧上でも見つけられるようにする。
  function openInstance(target: string) {
    const listed = visibleLocations(listOptions).includes(target);
    if (!listed) {
      setScope("all");
      setKind("all");
    }
    setInstanceSelection({ location: target });
    setReveal(target);
    if (!instances) navigate("/instances");
  }

  const groupPicker = (
    <GroupPicker
      groups={groups}
      allowAll={!instances}
      label={instances ? t("お気に入りグループ", "Favorite group") : t("フレンドの表示範囲", "Friend filter")}
      value={!instances && data.showAll ? ALL_FRIENDS : data.group}
      onChange={(value) => {
        const all = value === ALL_FRIENDS;
        if (!instances) data.chooseFriendScope(all);
        if (!all) data.choose(value);
        clearSelection();
      }}
    />
  );

  return (
    <div className={"social-columns" + (person || location ? " with-selection" : "")}>
      <section className="social-list" ref={setScroller}>
        <div className="list-tools">
          <small>
            {t("最終確認", "Last checked")} {checked ? clock(checked) : "—"}
          </small>
          <button className="quiet-action" onClick={data.refresh} disabled={busy && !failed}>
            <FiRefreshCw />
            {t("更新", "Refresh")}
          </button>
        </div>
        {instances ? (
          <InstanceFilters
            scope={scope}
            kind={kind}
            groupLabel={groups.find((g) => g.name === data.group)?.label}
            groupPicker={groupPicker}
            onScope={(value) => {
              setScope(value);
              setInstanceSelection(undefined);
            }}
            onKind={(value) => {
              setKind(value);
              setInstanceSelection(undefined);
            }}
          />
        ) : (
          <>
            <SearchBox
              query={query}
              onChange={(value) => {
                setQuery(value);
                selectPerson("");
              }}
            />
            {!search && groupPicker}
          </>
        )}
        <ListStatus
          busy={busy}
          failed={failed}
          message={
            instances
              ? t("一覧を更新できませんでした", "Could not refresh the list")
              : search || data.showAll
                ? t("一部のフレンドを取得できませんでした", "Some friends could not be loaded")
                : !checked
                  ? t("お気に入りを取得できませんでした", "Could not load favorites")
                  : t("一覧を更新できませんでした", "Could not refresh the list")
          }
          loading={
            instances ? t("インスタンスを取得中…", "Loading instances…") : t("フレンド一覧を取得中…", "Loading friends…")
          }
          retry={data.refresh}
        />
        {instances ? (
          <InstanceList
            locations={locations}
            byPlace={byPlace}
            placeAt={data.placeAt}
            account={account.id}
            selfId={self?.id}
            starred={starred}
            friendsReady={friendsReady}
            busy={busy}
            failed={failed}
            sortOrder={sortOrder}
            onSort={setSortOrder}
            selected={origin}
            onSelect={(l) => {
              setReveal(undefined);
              setInstanceSelection({ location: l });
            }}
            reveal={reveal}
            onRevealed={clearReveal}
            scroller={scroller}
          />
        ) : (
          <FriendList
            scroller={scroller}
            people={people}
            account={account.id}
            query={query}
            showAll={data.showAll}
            groupSize={inGroup.size}
            starred={starred}
            busy={busy}
            failed={failed}
            selected={selectedPerson}
            onSelect={selectPerson}
            placeAt={data.placeAt}
          />
        )}
      </section>
      {person || location ? (
        <SocialDetail
          key={person?.id ?? location}
          account={account}
          person={person}
          location={location}
          instanceFriends={
            location ? (
              <PlaceFriends
                friends={byPlace.get(location)}
                account={account.id}
                selfId={self?.id}
                starred={starred}
                friendsReady={friendsReady}
                onSelect={(friendId) => setInstanceSelection({ location, friendId })}
              />
            ) : undefined
          }
          backToInstance={person && origin ? () => setInstanceSelection({ location: origin }) : undefined}
          instanceOrigin={origin}
          openInstance={openInstance}
          placeAt={data.placeAt}
          fetchedAt={data.fetchedAt}
          starred={!!person && starred.has(person.id)}
          onPerson={data.applyFriend}
          onPlace={data.updatePlace}
          notify={notify}
          expire={expire}
          close={clearSelection}
        />
      ) : (
        <aside className="social-detail blank-detail">
          {instances ? t("インスタンスを選択", "Select an instance") : t("フレンドを選択", "Select a friend")}
        </aside>
      )}
    </div>
  );
}

// 全フレンドを名前で探す検索欄。
function SearchBox({ query, onChange }: { query: string; onChange: (query: string) => void }) {
  const t = useText();
  return (
    <label className="search-box">
      <FiSearch />
      <input
        aria-label={t("全フレンドから名前で検索", "Search all friends by name")}
        placeholder={t("全フレンドから名前で検索", "Search all friends by name")}
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />
      {query && (
        <button aria-label={t("検索をクリア", "Clear search")} onClick={() => onChange("")}>
          <FiX />
        </button>
      )}
    </label>
  );
}

// 取得中・取得失敗の帯。失敗時は再試行ボタンを出す（最終確認時刻は一覧上部に表示済み）。
function ListStatus(props: {
  busy: boolean;
  failed: boolean;
  message: string;
  loading: string;
  retry: () => void;
}) {
  const t = useText();
  if (!props.busy && !props.failed) return null;
  return (
    <div className={props.failed ? "list-state warn" : "list-state"} role="status">
      {props.failed ? (
        <>
          {props.message}{" "}
          <button onClick={props.retry}>{t("再試行", "Retry")}</button>
        </>
      ) : (
        <>
          <span className="loading loading-spinner loading-xs" />
          {props.loading}
        </>
      )}
    </div>
  );
}
