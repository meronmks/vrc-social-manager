import { useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiStar } from "react-icons/fi";
import {
  access,
  Account,
  clock,
  destination,
  instanceName,
  instanceNumber,
  isExpired,
  locationOf,
  Notify,
  Person,
  Phase,
  Place,
  PublicProfile,
  request,
  useText,
  where,
} from "@/libs/social";
import { ExternalLink } from "./externalLink";
import { Avatar, WorldPhoto } from "./media";
import { Occupancy, Presence } from "./presence";
import { SelfInvite } from "./selfInvite";

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

// 公開プロフィールを、表示を求められたときだけ取得する。
function useProfile(account: string, personId: string | undefined, enabled: boolean, expire: () => void) {
  const [profile, setProfile] = useState<PublicProfile>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [attempt, setAttempt] = useState(0);
  const latestExpire = useRef(expire);
  latestExpire.current = expire;
  useEffect(() => {
    if (!enabled || !personId) return;
    let live = true;
    setPhase("loading");
    void request(account, { kind: "profile", id: personId }).then(
      (result) => {
        if (!live) return;
        setProfile(result);
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
  }, [enabled, account, personId, attempt]);
  return { profile, phase, retry: () => setAttempt((n) => n + 1) };
}

// フレンドの現在地（またはインスタンス）を確認し、インスタンス情報と主催グループ名を一覧のキャッシュへ反映する。
function useConfirmedLocation(props: Props) {
  const [confirmed, setConfirmed] = useState<{ location: string; time: number }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [metadataError, setMetadataError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(props);
  latest.current = props;
  const account = props.account.id;
  const personId = props.person?.id;
  useEffect(() => {
    let live = true;
    async function load() {
      setPhase("loading");
      setMetadataError(false);
      setConfirmed(undefined);
      try {
        let location = props.location ?? "";
        if (personId) {
          const p = await request(account, { kind: "friend", id: personId });
          if (!live) return;
          location = locationOf(p);
          latest.current.onPerson({ ...p, location });
        }
        if (!live) return;
        setConfirmed({ location, time: Date.now() });
        setPhase("ready");
        if (!destination(location)) return;
        const place = await request(account, { kind: "instance", location });
        if (!live) return;
        latest.current.onPlace(location, place);
        if (place.type === "group" && place.ownerId) {
          const group = await request(account, { kind: "group", id: place.ownerId });
          if (live) latest.current.onPlace(location, { ...place, groupName: group.name });
        }
      } catch (e) {
        if (!live) return;
        if (isExpired(e)) latest.current.expire();
        // 現在地を確認できた後のインスタンス情報の失敗は、現在地の表示を残したまま再取得を促す。
        setPhase((previous) => (previous === "ready" ? previous : "failed"));
        setMetadataError(true);
      }
    }
    void load();
    return () => {
      live = false;
    };
  }, [account, personId, props.location, attempt]);
  return { confirmed, phase, metadataError, retry: () => setAttempt((n) => n + 1) };
}

// 右側の詳細パネル。フレンド詳細・公開プロフィール・インスタンス詳細を切り替えて表示する。
export function SocialDetail(props: Props) {
  const { account, person, notify, expire } = props;
  const [showProfile, setShowProfile] = useState(false);
  const profile = useProfile(account.id, person?.id, showProfile, expire);
  const current = useConfirmedLocation(props);
  const t = useText();
  const location = current.confirmed?.location ?? "";
  const target = destination(location);
  const place = props.placeAt(location);
  const title = person
    ? showProfile
      ? t("プロフィール", "Profile")
      : t("フレンド詳細", "Friend details")
    : t("インスタンス詳細", "Instance details");
  return (
    <aside className="social-detail">
      {props.backToInstance && (
        <button type="button" className="text-action" onClick={props.backToInstance} autoFocus>
          <FiArrowLeft aria-hidden="true" />
          {t("インスタンス詳細に戻る", "Back to instance")}
        </button>
      )}
      <div className="detail-bar">
        <b>{title}</b>
        <span className="detail-actions">
          {person && (
            <button className="text-action" onClick={() => setShowProfile(!showProfile)}>
              {showProfile ? t("フレンド詳細に戻る", "Back to details") : t("プロフィールを見る", "View profile")}
            </button>
          )}
          {/* インスタンス詳細では「現在地」の見出しを出さないため、確認時刻はここに置く */}
          {!person && current.confirmed && <CheckedAt time={current.confirmed.time} />}
          <button className="mobile-close quiet-action" onClick={props.close}>
            {t("閉じる", "Close")}
          </button>
        </span>
      </div>
      {person && (
        <header className="person-head">
          <Avatar
            person={
              showProfile && profile.profile
                ? { ...person, ...profile.profile, displayName: person.displayName }
                : person
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
            <ExternalLink url={"https://vrchat.com/home/user/" + encodeURIComponent(person.id)}>
              {t("Webでプロフィールを開く", "Open web profile")}
            </ExternalLink>
          </div>
        </header>
      )}
      {showProfile && person ? (
        <ProfileSection {...profile} />
      ) : (
        <>
          {/* インスタンス詳細では見出しが冗長なため、フレンド詳細のときだけ表示する */}
          {person && (
            <div className="detail-bar">
              <h3>{t("現在地", "Location")}</h3>
              {current.confirmed && <CheckedAt time={current.confirmed.time} />}
            </div>
          )}
          {current.phase === "loading" ? (
            <p role="status">
              {person
                ? t("現在地を取得中…", "Checking location…")
                : t("インスタンス情報を取得中…", "Loading instance details…")}
            </p>
          ) : current.phase === "failed" ? (
            <p role="alert">
              {person
                ? t("現在地を確認できませんでした", "Could not check location")
                : t("インスタンス情報を取得できませんでした", "Could not load instance details")}
            </p>
          ) : (
            <>
              {target && <WorldPhoto world={place?.world} account={account.id} />}
              <h2 className={person ? "place-title" : undefined}>{where(location, place, t)}</h2>
              {target && (
                <>
                  <div className="place-info">
                    <span className="access">{access(place, t)}</span>
                    <span>
                      {instanceName(place) && instanceName(place) + " · "}#{instanceNumber(target.instanceId)}{" "}
                      {place?.region?.toUpperCase()}
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
          {current.metadataError && (
            <button className="text-action" onClick={current.retry}>
              {current.phase === "failed" && person
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
          {target && current.phase === "ready" && (
            <>
              <SelfInvite
                key={account.id + location}
                account={account}
                location={location}
                notify={notify}
                expire={expire}
              />
              {!person && (
                <ExternalLink url={"https://vrchat.com/home/launch?" + new URLSearchParams(target)}>
                  {t("ブラウザで開く", "Open in browser")}
                </ExternalLink>
              )}
            </>
          )}
        </>
      )}
    </aside>
  );
}

// 最後に確認した時刻。
function CheckedAt({ time }: { time: number }) {
  const t = useText();
  return (
    <small>
      {clock(time)} {t("確認", "checked")}
    </small>
  );
}

// 公開プロフィールの自己紹介とリンク。
function ProfileSection({ profile, phase, retry }: ReturnType<typeof useProfile>) {
  const t = useText();
  if (phase === "loading") return <p role="status">{t("プロフィールを取得中…", "Loading profile…")}</p>;
  if (phase === "failed")
    return (
      <section>
        <p role="alert">{t("プロフィールを取得できませんでした", "Could not load the profile")}</p>
        <button className="quiet-action" onClick={retry}>
          {t("再試行", "Retry")}
        </button>
      </section>
    );
  return (
    <>
      <h3>{t("自己紹介", "Bio")}</h3>
      <p className="bio">{profile?.bio || "—"}</p>
      <h3>{t("プロフィールリンク", "Profile links")}</h3>
      {profile?.bioLinks?.length
        ? profile.bioLinks.map((url) => (
            <div key={url}>
              <ExternalLink url={url}>{url}</ExternalLink>
            </div>
          ))
        : "—"}
    </>
  );
}
