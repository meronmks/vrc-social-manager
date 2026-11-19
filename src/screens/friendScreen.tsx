import { useState } from "react";
import {
  FiFolder,
  FiRefreshCw,
  FiSearch,
  FiStar,
  FiX,
  FiMessageCircle,
  FiChevronRight,
} from "react-icons/fi";
import { Avatar, Occupancy, Presence, SocialDetail, WorldPhoto } from "@/components/ui/socialDetail";
import {
  access,
  Account,
  clock,
  destination,
  locationOf,
  Notify,
  Person,
  useText,
  where,
} from "@/libs/social";
import { useSocialData, viewSources } from "@/libs/useSocialData";

interface Props {
  account: Account;
  instances: boolean;
  notify: Notify;
  expire: () => void;
}
export default function FriendScreen({ account, instances, notify, expire }: Props) {
  const data = useSocialData(account.id, notify, expire);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [sortOrder, setSortOrder] = useState("friendCount");
  const [kind, setKind] = useState("all");
  const [selectedPerson, selectPerson] = useState("");
  const [instanceSelection, setInstanceSelection] = useState<{ location: string; friendId?: string }>();
  const t = useText();
  const starred = new Set(data.favorites.map((f) => f.favoriteId));
  const inGroup = new Set(data.favorites.filter((f) => f.tags.includes(data.group)).map((f) => f.favoriteId));
  const search = query.trim().toLocaleLowerCase();
  const everyone = Object.values(data.friends);
  const people = everyone
    .filter((p) =>
      search ? p.displayName.toLocaleLowerCase().includes(search) : data.showAll || inGroup.has(p.id),
    )
    .sort((a, b) => Number(b.online) - Number(a.online) || a.displayName.localeCompare(b.displayName));
  const byPlace = new Map<string, Person[]>();
  for (const person of everyone) {
    if (!person.online) continue;
    const location = locationOf(person);
    if (!destination(location)) continue;
    const others = byPlace.get(location);
    if (others) others.push(person);
    else byPlace.set(location, [person]);
  }
  const memberView = scope === "members";
  const locations = (memberView ? data.members : [...byPlace.keys()]).filter((location) => {
    const p = data.placeAt(location);
    if (memberView) return true;
    if (scope === "favorite" && !byPlace.get(location)?.some((f) => inGroup.has(f.id))) return false;
    return (
      kind === "all" || (kind === "group" ? p?.type === "group" : Boolean(p?.type && p.type !== "group"))
    );
  });
  if (instances && sortOrder === "friendCount") {
    locations.sort((a, b) => (byPlace.get(b)?.length ?? 0) - (byPlace.get(a)?.length ?? 0));
  }
  const view = instances
    ? memberView
      ? "members"
      : scope === "favorite"
        ? "favoritePlaces"
        : "allPlaces"
    : search || data.showAll
      ? "search"
      : "home";
  const sources = viewSources[view];
  const failed = sources.some((s) => data.phases[s] === "failed");
  const busy = sources.some((s) => data.phases[s] === "loading");
  const checked = data.checked[view];
  const origin = instances ? instanceSelection?.location : undefined;
  const person = instances
    ? data.friends[instanceSelection?.friendId ?? ""]
    : people.find((p) => p.id === selectedPerson);
  const location = person ? undefined : origin;
  function renderPlaceFriends(location: string, interactive = false) {
    const friends = byPlace.get(location);
    return (
      <small className="place-friends">
        {friends?.length
          ? friends.map((friend) => {
              const content = (
                <>
                  <Avatar person={friend} account={account.id} />
                  <span>
                    {starred.has(friend.id) && "☆ "}
                    {friend.displayName}
                  </span>
                </>
              );
              return interactive ? (
                <button
                  type="button"
                  className="place-friend friend-detail-link"
                  key={friend.id}
                  aria-label={t(
                    friend.displayName + "の詳細を開く",
                    "View details for " + friend.displayName,
                  )}
                  onClick={() => setInstanceSelection({ location, friendId: friend.id })}
                >
                  {content}
                </button>
              ) : (
                <span className="place-friend" key={friend.id}>
                  {content}
                </span>
              );
            })
          : data.phases.friends === "ready"
            ? t("フレンド 0人", "No friends here")
            : t("フレンド未確認", "Friends unconfirmed")}
      </small>
    );
  }

  const groups = data.groups.map((g, index) => {
    const slot = /^group_(\d+)$/.exec(g.name);
    const number = slot ? Number(slot[1]) : index;
    const name = g.displayName?.trim();
    const profileName = slot && account.friendGroupNames?.[number]?.trim();
    const label = (name && name !== g.name && name) || (profileName !== g.name && profileName);
    return { name: g.name, label: label || t(`お気に入り ${number + 1}`, `Favorites ${number + 1}`) };
  });
  const scopes = [
    ["all", t("全フレンド", "All friends")],
    ["favorite", t("お気に入りから", "From favorites")],
    ["members", t("所属グループ", "My groups")],
  ];
  const kinds = [
    ["all", t("すべて", "All")],
    ["group", t("グループ主催", "Group")],
    ["other", t("グループ以外", "Other")],
  ];
  const filterSummary = [
    scopes.find(([value]) => value === scope)?.[1],
    scope === "favorite" && groups.find((g) => g.name === data.group)?.label,
    !memberView && kinds.find(([value]) => value === kind)?.[1],
  ]
    .filter(Boolean)
    .join(" · ");
  const allOption = "*";
  const online = people.filter((p) => p.online).length;
  const countLabel = t(
    `${people.length}人中 ${online}人がオンライン`,
    `${online} of ${people.length} online`,
  );
  const groupPicker = (
    <label className="group-picker">
      <FiFolder />
      <select
        aria-label={
          instances ? t("お気に入りグループ", "Favorite group") : t("フレンドの表示範囲", "Friend filter")
        }
        value={!instances && data.showAll ? allOption : data.group}
        onChange={(e) => {
          const all = e.target.value === allOption;
          if (!instances) data.chooseFriendScope(all);
          if (!all) data.choose(e.target.value);
          selectPerson("");
          setInstanceSelection(undefined);
        }}
      >
        {!instances && <option value={allOption}>{t("全フレンド", "All friends")}</option>}
        {!data.groups.length && <option value="">{t("お気に入りグループ", "Favorite group")}</option>}
        {groups.map(({ name, label }) => (
          <option key={name} value={name}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );

  const retryLabel = t("再試行", "Retry");
  return (
    <div className={"social-columns" + (person || location ? " with-selection" : "")}>
      <section className="social-list">
        <h1>
          {instances
            ? t("インスタンス", "Instances")
            : search
              ? t("フレンド検索", "Friend search")
              : t("フレンド", "Friends")}
        </h1>
        <div className="list-tools">
          <small>
            {t("最終確認", "Last checked")}　{checked ? clock(checked) : "—"}
          </small>
          <button className="quiet-action" onClick={data.refresh} disabled={busy && !failed}>
            <FiRefreshCw />
            {t("更新", "Refresh")}
          </button>
        </div>
        {!instances && (
          <label className="search-box">
            <FiSearch />
            <input
              aria-label={t("全フレンドから名前で検索", "Search all friends by name")}
              placeholder={t("全フレンドから名前で検索", "Search all friends by name")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                selectPerson("");
              }}
            />
            {query && (
              <button
                aria-label={t("検索をクリア", "Clear search")}
                onClick={() => {
                  setQuery("");
                  selectPerson("");
                }}
              >
                <FiX />
              </button>
            )}
          </label>
        )}
        {instances ? (
          <details className="instance-filters">
            <summary>
              <strong>{t("絞り込み", "Filters")}</strong>
              <span title={filterSummary}>{filterSummary}</span>
              <FiChevronRight aria-hidden="true" />
            </summary>
            <label className="select-row">
              {t("探す対象", "Source")}
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  setInstanceSelection(undefined);
                }}
              >
                {scopes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {scope === "favorite" && groupPicker}
            {!memberView && (
              <div className="segmented" role="group" aria-label={t("インスタンス種別", "Instance type")}>
                {kinds.map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={kind === value}
                    onClick={() => {
                      setKind(value);
                      setInstanceSelection(undefined);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </details>
        ) : (
          !search && groupPicker
        )}
        {(busy || failed) && (
          <div className={failed ? "list-state warn" : "list-state"} role="status">
            {failed ? (
              <>
                {(search || data.showAll) && !instances
                  ? t("一部のフレンドを取得できませんでした", "Some friends could not be loaded")
                  : !checked && !instances
                    ? t("お気に入りを取得できませんでした", "Could not load favorites")
                    : t("一覧を更新できませんでした", "Could not refresh the list")}
                {checked ? " · " + clock(checked) + t("時点", " as of last check") : ""}{" "}
                <button onClick={data.refresh}>{retryLabel}</button>
              </>
            ) : (
              <>
                <span className="loading loading-spinner loading-xs" />
                {instances
                  ? t("インスタンスを取得中…", "Loading instances…")
                  : t("フレンド一覧を取得中…", "Loading friends…")}
              </>
            )}
          </div>
        )}
        {!instances ? (
          <>
            <h4>
              {!people.length && (busy || failed)
                ? failed
                  ? t("人数未確認", "Count unavailable")
                  : t("人数を集計中…", "Counting friends…")
                : countLabel}
              {people.length > 0 && (busy || failed) && t("（暫定）", " (provisional)")}
            </h4>
            {people.map((p) => (
              <button
                key={p.id}
                className="friend-row"
                aria-pressed={p.id === selectedPerson}
                onClick={() => selectPerson(p.id)}
              >
                <Avatar person={p} account={account.id} />
                <span className="friend-copy">
                  <strong>
                    {p.displayName}{" "}
                    {(search || data.showAll) && starred.has(p.id) && <FiStar className="star" />}
                  </strong>
                  {p.online && <small>{where(locationOf(p), data.placeAt(locationOf(p)), t)}</small>}
                  {p.statusDescription && (
                    <small className="note">
                      <FiMessageCircle />
                      {p.statusDescription}
                    </small>
                  )}
                </span>
                <Presence status={p.online ? p.status : "offline"} />
                <FiChevronRight className="row-chevron" />
              </button>
            ))}
            {!people.length && !busy && !failed && (
              <p className="empty-text">
                {search
                  ? t("「" + query + "」に一致するフレンドはいません", "No friends match “" + query + "”")
                  : data.showAll
                    ? t("フレンドがいません", "No friends yet")
                    : inGroup.size
                      ? t("フレンド情報を確認できませんでした", "Friend details unavailable")
                      : t("このグループにはまだフレンドがいません", "No friends in this group yet")}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="instance-list-heading">
              <h4>
                {t("インスタンス", "Instances")}　
                {locations.length || (!busy && !failed) ? locations.length : "—"}
              </h4>
              <select
                aria-label={t("並び順", "Sort order")}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="friendCount">{t("フレンドが多い順", "Most friends first")}</option>
                <option value="original">{t("取得順", "Fetch order")}</option>
              </select>
            </div>
            {locations.map((l) => {
              const p = data.placeAt(l);
              return (
                <button
                  className="place-row"
                  key={l}
                  aria-pressed={l === origin}
                  onClick={() => setInstanceSelection({ location: l })}
                >
                  <WorldPhoto world={p?.world} account={account.id} compact />
                  <strong>{where(l, p, t)}</strong>
                  <Occupancy place={p} />
                  <small className="instance-info">
                    {p?.displayName && p.displayName !== p.world?.name && p.displayName + " · "}
                    {access(p, t)} · #{destination(l)?.instanceId.split("~")[0]} {p?.groupName}
                  </small>
                  {renderPlaceFriends(l)}
                </button>
              );
            })}
            {!locations.length && !busy && !failed && (
              <p className="empty-text">{t("表示するインスタンスはありません", "No matching instances")}</p>
            )}
          </>
        )}
      </section>
      {person || location ? (
        <SocialDetail
          key={person?.id ?? location}
          account={account}
          person={person}
          location={location}
          instanceFriends={location ? renderPlaceFriends(location, true) : undefined}
          backToInstance={person && origin ? () => setInstanceSelection({ location: origin }) : undefined}
          placeAt={data.placeAt}
          starred={!!person && starred.has(person.id)}
          onPerson={data.applyFriend}
          onPlace={(l, p) => data.setPlaces((prev) => ({ ...prev, [l]: { ...prev[l], ...p } }))}
          notify={notify}
          expire={expire}
          close={() => {
            selectPerson("");
            setInstanceSelection(undefined);
          }}
        />
      ) : (
        <aside className="social-detail blank-detail">
          {instances ? t("インスタンスを選択", "Select an instance") : t("フレンドを選択", "Select a friend")}
        </aside>
      )}
    </div>
  );
}
