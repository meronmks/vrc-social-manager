import { useEffect, useState } from "react";
import { FiImage } from "react-icons/fi";
import { httpsUrls, request, UserImages, WorldInfo } from "@/libs/social";

// VRChat の API 経由でしか読めない画像（認証 Cookie が必要なもの）の URL。
const authenticatedImage = /^https:\/\/api\.vrchat\.cloud\/api\/1\/(file|image)\/file_/;

// ユーザーのアイコン。画像が読めない間は表示名の頭文字を出す。
export function Avatar({
  person,
  account,
}: {
  person: UserImages & { displayName: string };
  account?: string;
}) {
  const urls = httpsUrls([
    person.userIcon,
    person.iconUrl,
    person.profilePicOverrideThumbnail,
    person.profilePicOverride,
    person.currentAvatarThumbnailImageUrl,
    person.imageUrl,
    person.currentAvatarImageUrl,
  ]);
  return (
    <span className="social-avatar" aria-hidden="true">
      {person.displayName.slice(0, 1)}
      {urls.length > 0 && <RemoteImage key={JSON.stringify([account, urls])} urls={urls} account={account} />}
    </span>
  );
}

// ワールドの画像。compact は一覧用の小さなサムネイルで、画像がなくてもアイコン枠を出す。
export function WorldPhoto({
  world,
  account,
  compact = false,
}: {
  world?: WorldInfo;
  account: string;
  compact?: boolean;
}) {
  const urls = httpsUrls([world?.thumbnailImageUrl, world?.imageUrl]);
  if (!compact && !urls.length) return null;
  return (
    <span aria-hidden="true" className={compact ? "world-thumb" : "world-photo"}>
      <FiImage />
      {urls.length > 0 && <RemoteImage key={JSON.stringify([account, urls])} urls={urls} account={account} />}
    </span>
  );
}

// 直接読めず Rust 側から取得した画像の URL。
// 仮想スクロールで行が出入りするたびに直接読み込みの失敗を繰り返さないよう、次からは最初から Rust 側で取得する。
const nativeOnly = new Set<string>();

// 候補の URL を順に試す画像。直接読めない VRChat の画像は、アカウントのセッションで Rust 側から取得し直す。
function RemoteImage({ urls, account }: { urls: string[]; account?: string }) {
  const [index, setIndex] = useState(0);
  const [native, setNative] = useState(() => !!account && nativeOnly.has(urls[0]));
  const [source, setSource] = useState("");
  const url = urls[index];
  useEffect(() => {
    if (!native || !account || !url) return;
    let live = true;
    void request(account, { kind: "icon", url }).then(
      (data) => {
        nativeOnly.add(url);
        if (live) setSource(data);
      },
      () => {
        nativeOnly.delete(url);
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
        if (!native && account && authenticatedImage.test(url)) {
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
