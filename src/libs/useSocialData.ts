import { useEffect, useRef, useState } from "react";
import { userDataStore } from "./userDataStore";
import {
  destination,
  Favorite,
  FavoriteGroup,
  isExpired,
  locationOf,
  Notify,
  Person,
  Place,
  request,
  WorldInfo,
} from "./social";

export type Phase = "loading" | "ready" | "failed";
export const viewSources = {
  home: ["favorites", "friends"],
  search: ["friends"],
  allPlaces: ["friends", "places"],
  favoritePlaces: ["friends", "places", "favorites"],
  members: ["members"],
} as const;
type Places = Record<string, Place>;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useSocialData(account: string, notify: Notify, expire: () => void) {
  const [friends, setFriends] = useState<Record<string, Person>>({});
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [groups, setGroups] = useState<FavoriteGroup[]>([]);
  const [showAll, setShowAll] = useState<boolean>();
  const [group, setGroup] = useState("");
  const [places, setPlaces] = useState<Places>({});
  const [worlds, setWorlds] = useState<Record<string, WorldInfo & { loading?: boolean }>>({});
  const scheduleWorld = useRef<(location: string) => void>(() => {});
  const [members, setMembers] = useState<string[]>([]);
  const [phases, setPhases] = useState<Record<"friends" | "favorites" | "members" | "places", Phase>>({
    friends: "loading",
    favorites: "loading",
    members: "loading",
    places: "loading",
  });
  const [checked, setChecked] = useState<Record<string, number>>({});
  const [revision, setRevision] = useState(0);
  const selectedGroup = useRef("");
  const details = useRef(new Map<string, { version: number; person: Person }>());
  const version = useRef(0);
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
      .catch(() =>
        callbacks.current.notify("表示範囲を保存できませんでした", "Could not save the friend filter", true),
      );
  }

  function choose(name: string) {
    selectedGroup.current = name;
    setGroup(name);
    void userDataStore
      .setFavoriteGroup(account, name)
      .catch(() =>
        callbacks.current.notify(
          "グループの選択を保存できませんでした",
          "Could not save the selected group",
          true,
        ),
      );
  }

  function placeAt(location: string): Place | undefined {
    const place = places[location];
    const target = destination(location);
    const world = target && worlds[target.worldId];
    if (!world || !target) return place;
    return {
      ...target,
      ...place,
      worldLoading: world.loading,
      world: {
        name: world.name || place?.world?.name,
        thumbnailImageUrl: world.thumbnailImageUrl || place?.world?.thumbnailImageUrl,
        imageUrl: world.imageUrl || place?.world?.imageUrl,
      },
    };
  }

  function applyFriend(person: Person) {
    const location = locationOf(person);
    // Web利用中は現在地が offline でも接続中のため、詳細では接続状態を使う。
    if (person.state === "offline" || person.state === "active" || person.state === "online") {
      person = { ...person, online: person.state !== "offline" };
    }
    scheduleWorld.current(location);
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
    const completed = new Set<keyof typeof phases>();
    function phase(key: keyof typeof phases, state: Phase) {
      if (!live) return;
      setPhases((prev) => ({ ...prev, [key]: state }));
      if (state !== "ready") return;
      completed.add(key);
      // 同じ更新で表示対象の取得がすべて成功したときだけ確認時刻を進める。
      const timestamps: Record<string, number> = {};
      for (const [view, sources] of Object.entries(viewSources)) {
        if (sources.some((s) => s === key) && sources.every((s) => completed.has(s)))
          timestamps[view] = Date.now();
      }
      setChecked((prev) => ({ ...prev, ...timestamps }));
    }
    function fail(key: keyof typeof phases, e: unknown, ja: string, en: string) {
      if (!live) return;
      phase(key, "failed");
      callbacks.current.notify(ja, en, true);
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
        await pause(500);
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
            stopWorldRequests = isExpired(e) || String(e) === "http:429";
            if (live && isExpired(e)) callbacks.current.expire();
          }
        }
        if (live) setWorlds((prev) => ({ ...prev, [id]: { ...prev[id], ...world, loading: false } }));
        if (!stopWorldRequests) await pause(150);
      });
    }
    scheduleWorld.current = queueWorld;
    async function named(p: Place) {
      if (p.type === "group" && p.ownerId && !p.groupName) {
        if (!groupNames.has(p.ownerId)) {
          try {
            groupNames.set(p.ownerId, (await request(account, { kind: "group", id: p.ownerId })).name);
          } catch (e) {
            if (isExpired(e)) throw e;
          }
        }
        return { ...p, groupName: groupNames.get(p.ownerId) };
      }
      return p;
    }
    async function loadFriends() {
      const current: Record<string, Person> = {};
      const seen = new Set<string>();
      let placeQueue = Promise.resolve();
      let incomplete = false;
      let stopped: unknown;
      function queuePlace(location: string) {
        if (!destination(location) || seen.has(location)) return;
        seen.add(location);
        queueWorld(location);
        placeQueue = placeQueue.then(async () => {
          if (!live || stopped) return;
          try {
            const place = await request(account, { kind: "instance", location });
            if (!live) return;
            setPlaces((prev) => ({ ...prev, [location]: place }));
            const groupPlace = await named(place);
            if (live && groupPlace.groupName) {
              setPlaces((prev) => ({
                ...prev,
                [location]: { ...prev[location], groupName: groupPlace.groupName },
              }));
            }
          } catch (e) {
            incomplete = true;
            if (isExpired(e) || String(e) === "http:429") stopped = e;
          }
          await pause(150);
        });
      }
      try {
        const n = await userDataStore.getFetchFriendsCount();
        const merge = (page: Person[], offline: boolean) => {
          const batch: Record<string, Person> = {};
          for (const p of page) {
            batch[p.id] = newer({ ...p, online: !offline });
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
        if (incomplete) throw new Error();
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
        if (next && next !== saved)
          void userDataStore
            .setFavoriteGroup(account, next)
            .catch(() =>
              callbacks.current.notify(
                "グループの選択を保存できませんでした",
                "Could not save the selected group",
                true,
              ),
            );
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
        for (const raw of result.instances) {
          if (!live) return;
          const location = raw.worldId + ":" + raw.instanceId;
          entries[location] = raw;
          if (!raw.world?.name || !(raw.world.thumbnailImageUrl || raw.world.imageUrl)) queueWorld(location);
        }
        if (!live) return;
        setPlaces((prev) => ({ ...prev, ...entries }));
        setMembers(Object.keys(entries));
        phase("members", "ready");
        for (const [location, raw] of Object.entries(entries)) {
          if (!live) return;
          const place = await named(raw);
          if (live && place.groupName) {
            setPlaces((prev) => ({ ...prev, [location]: { ...prev[location], groupName: place.groupName } }));
          }
        }
      } catch (e) {
        fail("members", e, "所属グループの場所を取得できませんでした", "Could not load group instances");
      }
    }
    setPhases({ friends: "loading", favorites: "loading", members: "loading", places: "loading" });
    void loadFriends();
    void loadFavorites();
    void loadMembers();
    return () => {
      live = false;
    };
  }, [account, revision]);

  return {
    friends,
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
    refresh: () => setRevision((v) => v + 1),
    setPlaces,
  };
}
