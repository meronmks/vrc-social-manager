import { FiChevronRight, FiStar } from "react-icons/fi";
import { locationOf, Person, Place, useText, where } from "@/libs/social";
import { Avatar } from "./media";
import { Presence } from "./presence";

interface Props {
  people: Person[];
  account: string;
  query: string;
  showAll: boolean;
  /** 選択中のグループに登録されている人数（取得できたフレンドと区別するため） */
  groupSize: number;
  starred: Set<string>;
  busy: boolean;
  failed: boolean;
  selected: string;
  onSelect: (id: string) => void;
  placeAt: (location: string) => Place | undefined;
}

// フレンド一覧（人数の見出し、各行、空のときの案内）。
export function FriendList(props: Props) {
  const { people, query, showAll, busy, failed } = props;
  const t = useText();
  const searching = !!query.trim();
  const online = people.filter((p) => p.online).length;
  const pending = busy || failed;
  return (
    <>
      <h4>
        {!people.length && pending
          ? failed
            ? t("人数未確認", "Count unavailable")
            : t("人数を集計中…", "Counting friends…")
          : t(`${people.length}人中 ${online}人がオンライン`, `${online} of ${people.length} online`)}
        {people.length > 0 && pending && t("（暫定）", " (provisional)")}
      </h4>
      {people.map((p) => (
        <button
          key={p.id}
          className="friend-row"
          aria-pressed={p.id === props.selected}
          onClick={() => props.onSelect(p.id)}
        >
          <Avatar person={p} account={props.account} />
          <span className="friend-copy">
            <strong>
              {p.displayName} {(searching || showAll) && props.starred.has(p.id) && <FiStar className="star" />}
            </strong>
            {p.online && <small>{where(locationOf(p), props.placeAt(locationOf(p)), t)}</small>}
          </span>
          <Presence status={p.online ? p.status : "offline"} description={p.statusDescription} />
          <FiChevronRight className="row-chevron" />
        </button>
      ))}
      {!people.length && !pending && (
        <p className="empty-text">
          {searching
            ? t("「" + query + "」に一致するフレンドはいません", "No friends match “" + query + "”")
            : showAll
              ? t("フレンドがいません", "No friends yet")
              : props.groupSize
                ? t("フレンド情報を確認できませんでした", "Friend details unavailable")
                : t("このグループにはまだフレンドがいません", "No friends in this group yet")}
        </p>
      )}
    </>
  );
}
