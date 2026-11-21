import { useState } from "react";
import { FiRefreshCw, FiSearch, FiX } from "react-icons/fi";
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
import { Account, clock, Notify, useText } from "@/libs/social";
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
  const t = useText();

  const starred = new Set(data.favorites.map((f) => f.favoriteId));
  const inGroup = favoriteIdsIn(data.favorites, data.group);
  const search = query.trim().toLocaleLowerCase();
  const everyone = Object.values(data.friends);
  const people = visibleFriends(everyone, search, data.showAll, inGroup);
  const byPlace = groupByPlace(everyone);
  const locations = visibleLocations({
    scope,
    kind,
    sortOrder,
    members: data.members,
    byPlace,
    inGroup,
    placeAt: data.placeAt,
  });
  const groups = favoriteGroupOptions(data.groups, account.friendGroupNames);

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
      <section className="social-list">
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
          checked={checked}
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
            starred={starred}
            friendsReady={friendsReady}
            busy={busy}
            failed={failed}
            sortOrder={sortOrder}
            onSort={setSortOrder}
            selected={origin}
            onSelect={(l) => setInstanceSelection({ location: l })}
          />
        ) : (
          <FriendList
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
                starred={starred}
                friendsReady={friendsReady}
                onSelect={(friendId) => setInstanceSelection({ location, friendId })}
              />
            ) : undefined
          }
          backToInstance={person && origin ? () => setInstanceSelection({ location: origin }) : undefined}
          placeAt={data.placeAt}
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

// 取得中・取得失敗の帯。失敗時は最後に確認できた時刻と再試行ボタンを出す。
function ListStatus(props: {
  busy: boolean;
  failed: boolean;
  checked?: number;
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
          {props.message}
          {props.checked ? " · " + clock(props.checked) + t("時点", " as of last check") : ""}{" "}
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
