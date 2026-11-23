import { FiStar } from "react-icons/fi";
import { Person, useText } from "@/libs/social";
import { Avatar } from "./media";

interface Props {
  friends?: Person[];
  account: string;
  /** ログイン中のユーザー自身の ID。一覧に含まれていれば「自分」と表示し、詳細は開かない */
  selfId?: string;
  starred: Set<string>;
  /** フレンド一覧の取得が完了しているか（未完了なら 0 人と断定しない） */
  friendsReady: boolean;
  /** 指定すると各フレンドを押して詳細を開けるようにする */
  onSelect?: (friendId: string) => void;
}

// インスタンスにいるフレンドの一覧。
export function PlaceFriends({ friends, account, selfId, starred, friendsReady, onSelect }: Props) {
  const t = useText();
  if (!friends?.length) {
    return (
      <small className="place-friends">
        {friendsReady ? t("フレンド 0人", "No friends here") : t("フレンド未確認", "Friends unconfirmed")}
      </small>
    );
  }
  return (
    <small className="place-friends">
      {friends.map((friend) => {
        const self = friend.id === selfId;
        const content = (
          <>
            <Avatar person={friend} account={account} />
            <span>{friend.displayName}</span>
            {self && <span className="self-badge">{t("自分", "You")}</span>}
            {starred.has(friend.id) && <FiStar className="star" aria-hidden="true" />}
          </>
        );
        return onSelect && !self ? (
          <button
            type="button"
            className="place-friend friend-detail-link"
            key={friend.id}
            aria-label={t(friend.displayName + "の詳細を開く", "View details for " + friend.displayName)}
            onClick={() => onSelect(friend.id)}
          >
            {content}
          </button>
        ) : (
          <span className="place-friend" key={friend.id}>
            {content}
          </span>
        );
      })}
    </small>
  );
}
