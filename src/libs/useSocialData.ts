import { useCallback, useEffect, useRef, useState } from "react";
import { userDataStore } from "./userDataStore";
import {
  destination,
  Favorite,
  FavoriteGroup,
  FetchedAt,
  isExpired,
  isInGame,
  isRateLimited,
  locationOf,
  Notify,
  Person,
  Phase,
  Place,
  request,
  WorldInfo,
} from "./social";

// 一覧の種類ごとに、表示に必要な取得処理。
export const viewSources = {
  home: ["favorites", "friends"],
  search: ["friends"],
  allPlaces: ["friends", "places"],
  favoritePlaces: ["friends", "places", "favorites"],
  members: ["members"],
} as const;
export type ViewKey = keyof typeof viewSources;
type Source = "friends" | "favorites" | "members" | "places";
type Places = Record<string, Place>;
const loadingPhases: Record<Source, Phase> = {
  friends: "loading",
  favorites: "loading",
  members: "loading",
  places: "loading",
};

export function useSocialData(account: string, notify: Notify, expire: () => void) {
  const [friends, setFriends] = useState<Record<string, Person>>({});
  // ログイン中のユーザー自身。インスタンス一覧で自分のいる場所を示すために使う。
  const [me, setMe] = useState<Person>();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [groups, setGroups] = useState<FavoriteGroup[]>([]);
  const [showAll, setShowAll] = useState<boolean>();
  const [group, setGroup] = useState("");
  const [places, setPlaces] = useState<Places>({});
  const [worlds, setWorlds] = useState<Record<string, WorldInfo & { loading?: boolean }>>({});
  const scheduleWorld = useRef<(location: string) => void>(() => {});
  const [members, setMembers] = useState<string[]>([]);
  const [phases, setPhases] = useState(loadingPhases);
  const [checked, setChecked] = useState<Partial<Record<ViewKey, number>>>({});
  const [revision, setRevision] = useState(0);
  const selectedGroup = useRef("");
  const details = useRef(new Map<string, { version: number; person: Person }>());
  const version = useRef(0);
  // 項目ごとの最終取得時刻。詳細を開いたときに再取得が必要かの判断に使う（表示には使わないため ref で持つ）。
  const fetched = useRef({ friend: new Map<string, number>(), place: new Map<string, number>() });
  const fetchedAt = useCallback<FetchedAt>((kind, key) => fetched.current[kind].get(key), []);
  const callbacks = useRef({ notify, expire });
  callbacks.current = { notify, expire };

  useEffect(() => {
    let live = true;
    void userDataStore
      .getShowAllFriends(account)
      .then((all) => {
        if (live) setShowAll((chosen) => chosen ?? all);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [account]);

  function chooseFriendScope(all: boolean) {
    setShowAll(all);
    void userDataStore
      .setShowAllFriends(account, all)
      .catch((e) =>
        callbacks.current.notify("表示範囲を保存できませんでした", "Could not save the friend filter", true, e),
      );
  }

  function saveFavoriteGroup(name: string) {
    void userDataStore
      .setFavoriteGroup(account, name)
      .catch((e) =>
        callbacks.current.notify(
          "グループの選択を保存できませんでした",
          "Could not save the selected group",
          true,
          e,
        ),
      );
  }

  function choose(name: string) {
    selectedGroup.current = name;
    setGroup(name);
    saveFavoriteGroup(name);
  }

  // 詳細パネルで取得したインスタンス情報を一覧のキャッシュへ反映する。
  function updatePlace(location: string, place: Place) {
    fetched.current.place.set(location, Date.now());
    setPlaces((prev) => ({ ...prev, [location]: { ...prev[location], ...place } }));
  }

  // インスタンス情報とワールド情報を合わせて返す。一覧の集計結果を使い回せるよう、取得データが変わるまで同じ関数を保つ。
  const placeAt = useCallback(
    (location: string): Place | undefined => {
      const place = places[location];
      const target = destination(location);
      const world = target && worlds[target.worldId];
      if (!world || !target) return place;
      return {
        ...target,
        ...place,
        worldLoading: world.loading,
        world: {
          // 権限の判定に使うタグと既定値は、インスタンス API に含まれるワールド情報を優先する。
          tags: place?.world?.tags ?? world.tags,
          defaultContentSettings: place?.world?.defaultContentSettings ?? world.defaultContentSettings,
          disabledPropAbilities: place?.world?.disabledPropAbilities ?? world.disabledPropAbilities,
          name: world.name || place?.world?.name,
          thumbnailImageUrl: world.thumbnailImageUrl || place?.world?.thumbnailImageUrl,
          imageUrl: world.imageUrl || place?.world?.imageUrl,
        },
      };
    },
    [places, worlds],
  );

  function applyFriend(person: Person) {
    const location = locationOf(person);
    // 詳細取得時は接続状態でゲーム内かを判定し直す（Web のみの接続はオフライン扱い）。
    if (person.state === "offline" || person.state === "active" || person.state === "online") {
      person = { ...person, online: isInGame(person) };
    }
    scheduleWorld.current(location);
    fetched.current.friend.set(person.id, Date.now());
    details.current.set(person.id, { version: ++version.current, person });
    setFriends((prev) => ({ ...prev, [person.id]: { ...prev[person.id], ...person } }));
  }

  useEffect(() => {
    let live = true;
    const started = ++version.current;
    const groupNames = new Map<string, string>();
    const newer = (p: Person) => {
      const detail = details.current.get(p.id);
      return detail && detail.version > started ? { ...p, ...detail.person } : p;
    };
    const completed = new Set<Source>();
    function phase(key: Source, state: Phase) {
      if (!live) return;
      setPhases((prev) => ({ ...prev, [key]: state }));
      if (state !== "ready") return;
      completed.add(key);
      // 同じ更新で表示対象の取得がすべて成功したときだけ確認時刻を進める。
      const timestamps: Partial<Record<ViewKey, number>> = {};
      for (const [view, sources] of Object.entries(viewSources) as [ViewKey, readonly Source[]][]) {
        if (sources.includes(key) && sources.every((s) => completed.has(s))) timestamps[view] = Date.now();
      }
      setChecked((prev) => ({ ...prev, ...timestamps }));
    }
    function fail(key: Source, e: unknown, ja: string, en: string) {
      if (!live) return;
      phase(key, "failed");
      callbacks.current.notify(ja, en, true, e);
      if (isExpired(e)) callbacks.current.expire();
    }
    async function pages<T>(
      fetch: (offset: number) => Promise<T[]>,
      key: (row: T) => string,
      onPage?: (page: T[]) => void,
    ) {
      const all: T[] = [];
      const seen = new Set<string>();
      let offset = 0;
      while (live) {
        const page = await fetch(offset);
        if (!live || !page.length) break;
        offset += page.length;
        const fresh = page.filter((row) => !seen.has(key(row)));
        if (!fresh.length) throw new Error("一覧の続きが取得できませんでした");
        fresh.forEach((row) => seen.add(key(row)));
        all.push(...fresh);
        onPage?.(fresh);
      }
      return all;
    }
    const queuedWorlds = new Set<string>();
    let worldQueue = Promise.resolve();
    let stopWorldRequests = false;
    function queueWorld(location: string) {
      const id = destination(location)?.worldId;
      if (!live || !id || queuedWorlds.has(id)) return;
      queuedWorlds.add(id);
      setWorlds((prev) => ({ ...prev, [id]: { ...prev[id], loading: true } }));
      worldQueue = worldQueue.then(async () => {
        if (!live) return;
        let world: WorldInfo | undefined;
        if (!stopWorldRequests) {
          try {
            world = await request(account, { kind: "world", id });
          } catch (e) {
            stopWorldRequests = isExpired(e) || isRateLimited(e);
            if (live && isExpired(e)) callbacks.current.expire();
          }
        }
        if (live) setWorlds((prev) => ({ ...prev, [id]: { ...prev[id], ...world, loading: false } }));
      });
    }
    scheduleWorld.current = queueWorld;
    // グループ主催のインスタンスに主催グループ名を補う。同じ更新中はグループごとに一度だけ取得する。
    async function attachGroupName(location: string, p: Place) {
      if (p.type !== "group" || !p.ownerId || p.groupName) return;
      if (!groupNames.has(p.ownerId)) {
        try {
          groupNames.set(p.ownerId, (await request(account, { kind: "group", id: p.ownerId })).name);
        } catch (e) {
          if (isExpired(e)) throw e;
        }
      }
      const groupName = groupNames.get(p.ownerId);
      if (live && groupName) {
        setPlaces((prev) => ({ ...prev, [location]: { ...prev[location], groupName } }));
      }
    }
    async function loadFriends() {
      const current: Record<string, Person> = {};
      const seen = new Set<string>();
      let placeQueue = Promise.resolve();
      let incomplete = false;
      let stopped: unknown;
      function queuePlace(location: string) {
        const worldId = destination(location)?.worldId;
        if (!worldId || seen.has(location)) return;
        seen.add(location);
        // ワールド情報はインスタンスの応答にも含まれ、Rust 側でキャッシュされる。
        // インスタンスを先に取得し、その後のワールド取得はキャッシュから返るようにする。
        if (!queuedWorlds.has(worldId)) {
          setWorlds((prev) => ({ ...prev, [worldId]: { ...prev[worldId], loading: true } }));
        }
        placeQueue = placeQueue.then(async () => {
          try {
            if (!live || stopped) return;
            const place = await request(account, { kind: "instance", location });
            if (!live) return;
            fetched.current.place.set(location, Date.now());
            setPlaces((prev) => ({ ...prev, [location]: place }));
            await attachGroupName(location, place);
          } catch (e) {
            incomplete = true;
            if (isExpired(e) || isRateLimited(e)) stopped = e;
          } finally {
            // 取得中の表示を必ず解除するため、失敗時もワールドの取得を予約する。
            queueWorld(location);
          }
        });
      }
      try {
        // 自分の現在地を先に確認し、自分のいるインスタンスの情報から取得する。
        try {
          const self = await request(account, { kind: "me" });
          if (!live) return;
          const mine = { ...self, online: isInGame(self) };
          setMe(mine);
          if (mine.online) queuePlace(locationOf(mine));
        } catch (e) {
          // 自分の現在地が分からなくても一覧は出せるため、認証切れ以外は無視する
          if (isExpired(e)) throw e;
        }
        const n = await userDataStore.getFetchFriendsCount();
        const merge = (page: Person[], offline: boolean) => {
          const batch: Record<string, Person> = {};
          const now = Date.now();
          for (const p of page) {
            fetched.current.friend.set(p.id, now);
            // オンライン一覧には Web のみの接続も含まれるため、ゲーム内にいる人だけをオンラインにする。
            batch[p.id] = newer({ ...p, online: isInGame(p, !offline) });
            if (batch[p.id].online) queuePlace(locationOf(batch[p.id]));
          }
          Object.assign(current, batch);
          setFriends((prev) => ({ ...prev, ...batch }));
        };
        for (const offline of [false, true]) {
          await pages(
            (offset) => request(account, { kind: "friends", offset, n, offline }),
            (p) => p.id,
            (page) => merge(page, offline),
          );
        }
        if (!live) return;
        for (const id of Object.keys(current)) current[id] = newer(current[id]);
        setFriends(current);
        phase("friends", "ready");
      } catch (e) {
        fail("friends", e, "フレンド一覧を更新できませんでした", "Could not refresh friends");
      }
      if (!live) return;
      try {
        await placeQueue;
        if (stopped) throw stopped;
        if (incomplete) throw new Error("取得できなかったインスタンスがあります（個々の原因は直前の警告を参照）");
        phase("places", "ready");
      } catch (e) {
        fail("places", e, "一部のインスタンスを取得できませんでした", "Some instances could not be loaded");
      }
    }
    async function loadFavorites() {
      try {
        const saved = selectedGroup.current || (await userDataStore.getFavoriteGroup(account));
        const favoriteGroups = await request(account, { kind: "groups" });
        if (!live) return;
        const slots = favoriteGroups.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
        const preferred = selectedGroup.current || saved;
        const next = slots.find((g) => g.name === preferred)?.name ?? slots[0]?.name ?? "";
        setGroups(slots);
        selectedGroup.current = next;
        setGroup(next);
        if (next && next !== saved) saveFavoriteGroup(next);
        const entries = await pages(
          (offset) => request(account, { kind: "favorites", offset }),
          (f) => f.favoriteId,
        );
        if (!live) return;
        setFavorites(entries);
        phase("favorites", "ready");
      } catch (e) {
        fail("favorites", e, "お気に入りを取得できませんでした", "Could not load favorites");
      }
    }
    async function loadMembers() {
      try {
        const result = await request(account, { kind: "memberInstances" });
        const entries: Places = {};
        const now = Date.now();
        for (const raw of result.instances) {
          if (!live) return;
          const location = raw.worldId + ":" + raw.instanceId;
          entries[location] = raw;
          fetched.current.place.set(location, now);
          if (!raw.world?.name || !(raw.world.thumbnailImageUrl || raw.world.imageUrl)) queueWorld(location);
        }
        if (!live) return;
        setPlaces((prev) => ({ ...prev, ...entries }));
        setMembers(Object.keys(entries));
        phase("members", "ready");
        for (const [location, raw] of Object.entries(entries)) {
          if (!live) return;
          await attachGroupName(location, raw);
        }
      } catch (e) {
        fail("members", e, "所属グループの場所を取得できませんでした", "Could not load group instances");
      }
    }
    setPhases(loadingPhases);
    void loadFriends();
    void loadFavorites();
    void loadMembers();
    return () => {
      live = false;
    };
  }, [account, revision]);

  return {
    friends,
    me,
    favorites,
    groups,
    group,
    showAll: showAll ?? false,
    chooseFriendScope,
    choose,
    placeAt,
    members,
    phases,
    checked,
    applyFriend,
    fetchedAt,
    refresh: () => setRevision((v) => v + 1),
    updatePlace,
  };
}
