import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { FiImage } from "react-icons/fi";
import { httpsUrls, UserImages, WorldInfo } from "@/libs/social";

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

// Rust 側の画像プロトコル（src-tauri の IMAGE_SCHEME）経由で読む URL。
// IPC で base64 を受け渡さず、`<img>` が直接バイト列を受け取る。
function nativeUrl(account: string, url: string) {
  return `${convertFileSrc("image", "vrcimg")}?${new URLSearchParams({ account, url })}`;
}

// 候補の URL を順に試す画像。直接読めない VRChat の画像は、アカウントのセッションで Rust 側から取得し直す。
function RemoteImage({ urls, account }: { urls: string[]; account?: string }) {
  const [index, setIndex] = useState(0);
  const [native, setNative] = useState(() => !!account && nativeOnly.has(urls[0]));
  const url = urls[index];
  if (!url) return null;
  const source = native && account ? nativeUrl(account, url) : url;
  return (
    <img
      key={source}
      src={source}
      loading="lazy"
      alt=""
      onLoad={() => {
        if (native) nativeOnly.add(url);
      }}
      onError={() => {
        if (!native && account && authenticatedImage.test(url)) {
          setNative(true);
          return;
        }
        if (native) nativeOnly.delete(url);
        const next = urls[index + 1];
        setNative(!!account && !!next && nativeOnly.has(next));
        setIndex(index + 1);
      }}
    />
  );
}
