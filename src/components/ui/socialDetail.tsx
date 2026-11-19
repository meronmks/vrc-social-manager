import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { FiExternalLink, FiImage, FiSend, FiStar } from "react-icons/fi";
import {
  access,
  Account,
  clock,
  destination,
  isExpired,
  locationOf,
  Notify,
  Person,
  Place,
  PublicProfile,
  WorldInfo,
  request,
  useText,
  UserImages,
  where,
} from "@/libs/social";

export function Avatar({
  person,
  account,
}: {
  person: UserImages & { displayName: string };
  account?: string;
}) {
  const urls = [
    ...new Set(
      [
        person.userIcon,
        person.iconUrl,
        person.profilePicOverrideThumbnail,
        person.profilePicOverride,
        person.currentAvatarThumbnailImageUrl,
        person.imageUrl,
        person.currentAvatarImageUrl,
      ].filter((url): url is string => !!url?.startsWith("https://")),
    ),
  ];
  return (
    <span className="social-avatar" aria-hidden="true">
      {person.displayName.slice(0, 1)}
      {urls.length > 0 && <RemoteImage key={JSON.stringify([account, urls])} urls={urls} account={account} />}
    </span>
  );
}

export function WorldPhoto({
  world,
  account,
  compact = false,
}: {
  world?: WorldInfo;
  account: string;
  compact?: boolean;
}) {
  const urls = [
    ...new Set(
      [world?.thumbnailImageUrl, world?.imageUrl].filter(
        (url): url is string => !!url?.startsWith("https://"),
      ),
    ),
  ];
  if (!compact && !urls.length) return null;
  return (
    <span aria-hidden="true" className={compact ? "world-thumb" : "world-photo"}>
      <FiImage />
      {urls.length > 0 && <RemoteImage key={JSON.stringify([account, urls])} urls={urls} account={account} />}
    </span>
  );
}

function RemoteImage({ urls, account }: { urls: string[]; account?: string }) {
  const [index, setIndex] = useState(0);
  const [native, setNative] = useState(false);
  const [source, setSource] = useState("");
  const url = urls[index];
  useEffect(() => {
    if (!native || !account || !url) return;
    let live = true;
    void request(account, { kind: "icon", url }).then(
      (data) => {
        if (live) setSource(data);
      },
      () => {
        if (live) {
          setNative(false);
          setIndex(index + 1);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [account, index, native, url]);
  if (!url || (native && !source)) return null;
  return (
    <img
      key={source || url}
      src={source || url}
      loading="lazy"
      alt=""
      onError={() => {
        if (!native && account && /^https:\/\/api\.vrchat\.cloud\/api\/1\/(file|image)\/file_/.test(url)) {
          setNative(true);
        } else {
          setSource("");
          setNative(false);
          setIndex(index + 1);
        }
      }}
    />
  );
}

export function Presence({ status }: { status?: string }) {
  const t = useText();
  const names: Record<string, string> = {
    "join me": t("合流歓迎", "Join me"),
    active: t("オンライン", "Online"),
    busy: t("取り込み中", "Busy"),
    "ask me": t("先に聞いて", "Ask me"),
    offline: t("オフライン", "Offline"),
  };
  return (
    <span className="presence" data-status={status}>
      <i />
      {names[status ?? ""] ?? t("状態不明", "Unknown")}
    </span>
  );
}
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

function External({ url, children }: { url: string; children: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  const t = useText();
  if (!/^https?:\/\//i.test(url)) return null;
  return (
    <>
      <a
        className="text-action"
        href={url}
        onClick={(e) => {
          e.preventDefault();
          setFailed(false);
          void open(url).catch(() => setFailed(true));
        }}
      >
        {children} <FiExternalLink aria-hidden />
      </a>
      {failed && <small role="alert">{t("ブラウザで開けませんでした", "Could not open the browser")}</small>}
    </>
  );
}

function Invite({
  account,
  location,
  notify,
  expire,
}: {
  account: Account;
  location: string;
  notify: Notify;
  expire: () => void;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "unknown" | "failed">("idle");
  const lock = useRef(false);
  const t = useText();
  async function send() {
    if (lock.current) return;
    lock.current = true;
    setState("sending");
    try {
      await request(account.id, { kind: "invite", location });
      setState("sent");
      notify("自分に招待を送りました", "Invitation sent to yourself");
    } catch (e) {
      if (isExpired(e)) expire();
      const definitive = /^http:4\d\d$/.test(String(e)) && String(e) !== "http:408";
      setState(definitive ? "failed" : "unknown");
      if (definitive) notify("招待を送れませんでした", "Could not send the invitation", true);
      else notify("送信結果を確認できませんでした", "Could not confirm delivery");
    } finally {
      lock.current = false;
    }
  }
  return (
    <section className="invite">
      <small>
        {t("受け取りアカウント", "Receiving account")} · {account.displayName}
      </small>
      {(state === "unknown" || state === "failed") && (
        <p role="status">
          {state === "unknown"
            ? t("送信結果を確認できませんでした", "Could not confirm delivery")
            : t("招待を送れませんでした", "Could not send the invitation")}
        </p>
      )}
      <button
        className={state === "idle" ? "primary-action" : "quiet-action"}
        onClick={send}
        disabled={state === "sending" || state === "sent"}
      >
        <FiSend />
        {state === "idle"
          ? t("自分に招待を送る", "Invite myself")
          : state === "sending"
            ? t("送信中…", "Sending…")
            : state === "sent"
              ? t("自分に招待を送りました", "Invitation sent")
              : t("再送", "Send again")}
      </button>
    </section>
  );
}

interface Props {
  account: Account;
  person?: Person;
  location?: string;
  instanceFriends?: React.ReactNode;
  backToInstance?: () => void;
  placeAt: (location: string) => Place | undefined;
  starred: boolean;
  onPerson: (p: Person) => void;
  onPlace: (location: string, place: Place) => void;
  notify: Notify;
  expire: () => void;
  close: () => void;
}

export function SocialDetail(props: Props) {
  const { account, person, notify, expire } = props;
  const [profile, setProfile] = useState(false);
  const [confirmed, setConfirmed] = useState<{ location: string; time: number }>();
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading");
  const [profileData, setProfileData] = useState<PublicProfile>();
  const [profilePhase, setProfilePhase] = useState<"loading" | "ready" | "failed">("loading");
  const [profileRetry, setProfileRetry] = useState(0);
  const [metadataError, setMetadataError] = useState(false);
  const [retry, setRetry] = useState(0);
  const latest = useRef(props);
  latest.current = props;
  const t = useText();
  const personId = person?.id;
  useEffect(() => {
    if (!profile || !personId) return;
    let live = true;
    setProfilePhase("loading");
    void request(account.id, { kind: "profile", id: personId }).then(
      (result) => {
        if (!live) return;
        setProfileData(result);
        setProfilePhase("ready");
      },
      (e) => {
        if (!live) return;
        setProfilePhase("failed");
        if (isExpired(e)) latest.current.expire();
      },
    );
    return () => {
      live = false;
    };
  }, [profile, account.id, personId, profileRetry]);
  useEffect(() => {
    let live = true;
    async function load() {
      setPhase("loading");
      setMetadataError(false);
      setConfirmed(undefined);
      try {
        let location = props.location ?? "";
        if (personId) {
          const p = await request(account.id, { kind: "friend", id: personId });
          if (!live) return;
          location = locationOf(p);
          latest.current.onPerson({ ...p, location });
        }
        if (!live) return;
        setConfirmed({ location, time: Date.now() });
        setPhase("ready");
        if (!destination(location)) return;
        const place = await request(account.id, { kind: "instance", location });
        if (!live) return;
        latest.current.onPlace(location, place);
        if (place.type === "group" && place.ownerId) {
          const group = await request(account.id, { kind: "group", id: place.ownerId });
          if (live) latest.current.onPlace(location, { ...place, groupName: group.name });
        }
      } catch (e) {
        if (!live) return;
        if (isExpired(e)) latest.current.expire();
        setPhase((previous) => (previous === "ready" ? previous : "failed"));
        setMetadataError(true);
      }
    }
    void load();
    return () => {
      live = false;
    };
  }, [account.id, personId, props.location, retry]);
  const location = confirmed?.location ?? "";
  const target = destination(location);
  const place = props.placeAt(location);
  return (
    <aside className="social-detail">
      {props.backToInstance && (
        <button type="button" className="text-action" onClick={props.backToInstance} autoFocus>
          {t("インスタンス詳細に戻る", "Back to instance")}
        </button>
      )}
      <div className="detail-bar">
        <b>
          {person
            ? profile
              ? t("プロフィール", "Profile")
              : t("フレンド詳細", "Friend details")
            : t("インスタンス詳細", "Instance details")}
        </b>
        {person && (
          <button className="text-action" onClick={() => setProfile(!profile)}>
            {profile ? t("フレンド詳細に戻る", "Back to details") : t("プロフィールを見る", "View profile")}
          </button>
        )}
        <button className="mobile-close" onClick={props.close}>
          {t("閉じる", "Close")}
        </button>
      </div>
      {person && (
        <header className="person-head">
          <Avatar
            person={
              profile && profileData ? { ...person, ...profileData, displayName: person.displayName } : person
            }
            account={account.id}
          />
          <div>
            <h2>
              {person.displayName} {props.starred && <FiStar className="star" />}
            </h2>
            <Presence status={person.online === false ? "offline" : person.status} />
          </div>
          {person.statusDescription && <p>{person.statusDescription}</p>}
          <div className="person-web">
            <External url={"https://vrchat.com/home/user/" + encodeURIComponent(person.id)}>
              {t("Webでプロフィールを開く", "Open web profile")}
            </External>
          </div>
        </header>
      )}
      {profile && person ? (
        profilePhase === "loading" ? (
          <p role="status">{t("プロフィールを取得中…", "Loading profile…")}</p>
        ) : profilePhase === "failed" ? (
          <section>
            <p role="alert">{t("プロフィールを取得できませんでした", "Could not load the profile")}</p>
            <button className="quiet-action" onClick={() => setProfileRetry((n) => n + 1)}>
              {t("再試行", "Retry")}
            </button>
          </section>
        ) : (
          <>
            <h3>{t("自己紹介", "Bio")}</h3>
            <p className="bio">{profileData?.bio || "—"}</p>
            <h3>{t("プロフィールリンク", "Profile links")}</h3>
            {profileData?.bioLinks?.length
              ? profileData.bioLinks.map((url) => (
                  <div key={url}>
                    <External url={url}>{url}</External>
                  </div>
                ))
              : "—"}
          </>
        )
      ) : (
        <>
          <div className="detail-bar">
            <h3>{t("現在地", "Location")}</h3>
            {confirmed && (
              <small>
                {clock(confirmed.time)} {t("確認", "checked")}
              </small>
            )}
          </div>
          {phase === "loading" ? (
            <p role="status">{t("現在地を取得中…", "Checking location…")}</p>
          ) : phase === "failed" ? (
            <p role="alert">{t("現在地を確認できませんでした", "Could not check location")}</p>
          ) : (
            <>
              {target && <WorldPhoto world={place?.world} account={account.id} />}
              <h2>{where(location, place, t)}</h2>
              {target && (
                <>
                  <div className="place-info">
                    <span className="access">{access(place, t)}</span>
                    <span>
                      {place?.displayName &&
                        place.displayName !== place.world?.name &&
                        place.displayName + " · "}
                      #{target.instanceId.split("~")[0]} {place?.region?.toUpperCase()}
                    </span>
                    <Occupancy place={place} />
                  </div>
                  {place?.groupName && (
                    <p>
                      {t("主催", "Host")} · {place.groupName}
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {metadataError && (
            <button className="text-action" onClick={() => setRetry((x) => x + 1)}>
              {phase === "failed"
                ? t("現在地を再取得", "Retry location")
                : t("インスタンス情報を再取得", "Retry instance details")}
            </button>
          )}
          {props.instanceFriends && (
            <section aria-labelledby="instance-friends-title">
              <h3 id="instance-friends-title">{t("この場所にいるフレンド", "Friends here")}</h3>
              {props.instanceFriends}
            </section>
          )}
          {target && phase === "ready" && (
            <>
              <Invite
                key={account.id + location}
                account={account}
                location={location}
                notify={notify}
                expire={expire}
              />
              {!person && (
                <External url={"https://vrchat.com/home/launch?" + new URLSearchParams(target)}>
                  {t("ブラウザで開く", "Open in browser")}
                </External>
              )}
            </>
          )}
        </>
      )}
    </aside>
  );
}
