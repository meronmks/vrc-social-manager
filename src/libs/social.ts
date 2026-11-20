import { commands, JsonValue, Resource, Result } from "@/bindings";
import { useTranslation } from "react-i18next";
import { InstanceDetailData } from "./exportInterfaces";

export type Text = (ja: string, en: string) => string;
export function useText(): Text {
  const { i18n } = useTranslation();
  return (ja, en) => (i18n.language.startsWith("en") ? en : ja);
}

export interface UserImages {
  userIcon?: string;
  iconUrl?: string;
  profilePicOverrideThumbnail?: string;
  profilePicOverride?: string;
  currentAvatarThumbnailImageUrl?: string;
  imageUrl?: string;
  currentAvatarImageUrl?: string;
}

export interface Account extends UserImages {
  friendGroupNames?: string[];
  id: string;
  displayName: string;
  loginId?: string | null;
}

export interface Person extends UserImages {
  online?: boolean;
  state?: "online" | "active" | "offline";
  id: string;
  displayName: string;
  status?: string;
  statusDescription?: string;
  location?: string;
  bio?: string;
  bioLinks?: string[];
  worldId?: string;
  instanceId?: string;
}
export interface FavoriteGroup {
  name: string;
  displayName: string;
}
export interface Favorite {
  favoriteId: string;
  tags: string[];
}
export interface WorldInfo {
  name?: string;
  thumbnailImageUrl?: string;
  imageUrl?: string;
}
export type Place = Partial<Omit<InstanceDetailData, "world">> & {
  worldId: string;
  instanceId: string;
  groupName?: string;
  world?: WorldInfo;
  worldLoading?: boolean;
};
export type PublicProfile = UserImages & Pick<Person, "bio" | "bioLinks">;
export type AuthReply = Account | { method: "emailOtp" | "totp" };
async function data<T>(call: Promise<Result<JsonValue, string>>): Promise<T> {
  const result = await call;
  if (result.status === "error") throw result.error;
  return result.data as T;
}

export const session = {
  switch: (id: string) => data<Account>(commands.socialSwitch(id)),
  login: (target: string | undefined, loginId: string, password: string) =>
    data<AuthReply>(commands.socialLogin(target ?? null, loginId, password)),
  verify: (code: string) => data<Account>(commands.socialOtp(code)),
  cancel: commands.socialCancel,
  logout: (id: string) => data<null>(commands.socialLogout(id)),
};

interface Resources {
  friends: Person[];
  groups: FavoriteGroup[];
  icon: string;
  favorites: Favorite[];
  memberInstances: { instances: Place[] };
  friend: Person;
  profile: PublicProfile;
  world: WorldInfo;
  instance: Place;
  invite: boolean;
  group: { name: string };
}
export function request<Q extends Resource>(account: string, resource: Q) {
  return data<Resources[Q["kind"]]>(commands.socialRequest(account, resource));
}
export function destination(value?: string) {
  if (!value) return null;
  const separator = value.indexOf(":");
  if (!value.startsWith("wrld_") || separator < 6 || !value.slice(separator + 1)) return null;
  return { worldId: value.slice(0, separator), instanceId: value.slice(separator + 1) };
}
export function locationOf(person: Person): string {
  return (
    person.location ||
    (person.worldId?.startsWith("wrld_") && person.instanceId
      ? person.worldId + ":" + person.instanceId
      : person.worldId || "")
  );
}
export function where(value: string, place: Place | undefined, t: Text) {
  if (place?.world?.name) return place.world.name;
  if (place?.worldLoading) return t("ワールド名を取得中…", "Loading world name…");
  switch (value) {
    case "private":
      return t("居場所は非公開", "Private location");
    case "traveling":
      return t("移動中", "Traveling");
    case "offline":
      return t("オフライン", "Offline");
    default:
      return destination(value)
        ? t("ワールド名未確認", "World name unavailable")
        : t("居場所は未確認", "Location unknown");
  }
}
export function access(place: Place | undefined, t: Text) {
  switch (place?.type) {
    case "public":
      return "Public";
    case "friends":
      return "Friends";
    case "hidden":
      return "Friends+";
    case "private":
      return place.canRequestInvite ? "Invite+" : "Invite";
    case "group":
      return (
        { public: "Group Public", plus: "Group+", members: "Group" }[place.groupAccessType ?? ""] ?? "Group"
      );
    default:
      return t("種別未確認", "Unknown access");
  }
}
export function clock(time: number) {
  return new Date(time).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit" });
}
export function isExpired(error: unknown) {
  return String(error) === "http:401";
}
export interface Notice {
  time: number;
  ja: string;
  en: string;
  error?: boolean;
}
export type Notify = (ja: string, en: string, error?: boolean) => void;
