import { useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiLayers, FiStar } from "react-icons/fi";
import {
  access,
  Account,
  clock,
  destination,
  FetchedAt,
  instanceName,
  instanceNumber,
  isExpired,
  locationOf,
  Notify,
  Person,
  Phase,
  Place,
  PublicProfile,
  RECHECK_AFTER_MS,
  request,
  useText,
  where,
} from "@/libs/social";
import { ExternalLink } from "./externalLink";
import { InstanceExtras, PlaceTags } from "./instanceExtras";
import { Avatar, WorldPhoto } from "./media";
import { Occupancy, Presence } from "./presence";
import { RegionFlag } from "./region";
import { SelfInvite } from "./selfInvite";

interface Props {
  account: Account;
  person?: Person;
  location?: string;
  instanceFriends?: React.ReactNode;
  backToInstance?: () => void;
  /** 詳細を開いた元のインスタンス（インスタンス一覧からフレンドを開いたとき） */
  instanceOrigin?: string;
  /** フレンドの現在地のインスタンスを、インスタンス一覧で選択して表示する */
  openInstance?: (location: string) => void;
  placeAt: (location: string) => Place | undefined;
  fetchedAt: FetchedAt;
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
// 一覧の更新などで最後に取得してから RECHECK_AFTER_MS 経っていなければ、取得済みの情報をそのまま使う。
// 再取得ボタンからの確認は経過時間にかかわらず取得し直す。
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
      // 最後の取得が新しければその時刻を返す（再取得ボタンからの確認では使わない）
      function recent(kind: "friend" | "place", key: string) {
        const time = latest.current.fetchedAt(kind, key);
        return attempt === 0 && time !== undefined && Date.now() - time < RECHECK_AFTER_MS ? time : undefined;
      }
      setPhase("loading");
      setMetadataError(false);
      setConfirmed(undefined);
      try {
        let location = props.location ?? "";
        let time = Date.now();
        const known = latest.current.person;
        const friendTime = personId ? recent("friend", personId) : undefined;
        if (personId && known && friendTime !== undefined) {
          location = locationOf(known);
          time = friendTime;
        } else if (personId) {
          const p = await request(account, { kind: "friend", id: personId });
          if (!live) return;
          location = locationOf(p);
          time = Date.now();
          latest.current.onPerson({ ...p, location });
        }
        if (!live) return;
        const placeTime = destination(location) ? recent("place", location) : undefined;
        // インスタンス詳細では、取得済みのインスタンス情報の時刻を確認時刻として出す
        if (!personId && placeTime !== undefined) time = placeTime;
        setConfirmed({ location, time });
        setPhase("ready");
        if (!destination(location) || placeTime !== undefined) return;
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

  // 詳細を開いたまま一覧を更新したとき、届いた新しい情報で現在地と確認時刻を置き換える。
  // 開いた直後（前回値なし）と確認中は、確認結果を優先するため何もしない。
  const person = props.person;
  const previousPerson = useRef(person);
  const latestState = useRef({ phase, confirmed });
  latestState.current = { phase, confirmed };
  useEffect(() => {
    const previous = previousPerson.current;
    previousPerson.current = person;
    if (!person || !previous || previous === person || latestState.current.phase === "loading") return;
    const location = locationOf(person);
    // 場所が変わった場合、前の場所のインスタンス情報の取得失敗はもう関係ないため消す
    if (latestState.current.confirmed?.location !== location) setMetadataError(false);
    setConfirmed({ location, time: latest.current.fetchedAt("friend", person.id) ?? Date.now() });
    setPhase("ready");
  }, [person]);

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
                      <RegionFlag region={place?.region} />
                    </span>
                    <Occupancy place={place} />
                  </div>
                  {place?.groupName && (
                    <p>
                      {t("主催", "Host")} · {place.groupName}
                    </p>
                  )}
                  <PlaceTags key={location} account={account.id} place={place} expire={expire} />
                  {/* 開いた元のインスタンスと同じ場所なら「インスタンス詳細に戻る」と重複するため出さない */}
                  {person && props.openInstance && location !== props.instanceOrigin && (
                    <button className="text-action" onClick={() => props.openInstance?.(location)}>
                      <FiLayers aria-hidden="true" />
                      {t("インスタンス画面で見る", "View in Instances")}
                    </button>
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
              {/* 権限やカテゴリなど、必要なときだけ見る情報は折りたたんで最後に置く。
                  フレンド詳細の現在地では「インスタンス画面で見る」から確認できるため出さない */}
              {!person && <InstanceExtras place={place} />}
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
