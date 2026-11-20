import { commands, type JsonValue, type Preference } from "@/bindings";

async function read(setting: Preference) {
  const result = await commands.settingsGet(setting);
  if (result.status === "error") throw result.error;
  return result.data;
}

async function write(setting: Preference, value: JsonValue) {
  const result = await commands.settingsSet(setting, value);
  if (result.status === "error") throw result.error;
}

export const userDataStore = {
  async getUsers() {
    const rows = await read({ kind: "accounts" });
    if (!Array.isArray(rows)) throw new Error("storage");
    return rows.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row) ||
          typeof row.id !== "string" || typeof row.displayName !== "string") {
        throw new Error("storage");
      }
      return {
        ...row,
        id: row.id,
        displayName: row.displayName,
        loginId: typeof row.loginId === "string" ? row.loginId : undefined,
        lastLogin: new Date(typeof row.lastLogin === "number" || typeof row.lastLogin === "string" ? row.lastLogin : 0),
      };
    });
  },
  async getCurrentUserId() {
    const id = await read({ kind: "currentAccount" });
    return typeof id === "string" ? id : null;
  },
  async getTheme() {
    return (await read({ kind: "theme" })) === "dark" ? "dark" : "light";
  },
  setTheme: (value: string) => write({ kind: "theme" }, value),
  async getLanguage() {
    return (await read({ kind: "language" })) === "en" ? "en" : "ja";
  },
  setLanguage: (value: string) => write({ kind: "language" }, value),
  async getFetchFriendsCount() {
    const n = await read({ kind: "fetchFriendsCount" });
    return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 100 ? n : 50;
  },
  setFetchFriendsCount: (value: number) => write({ kind: "fetchFriendsCount" }, value),
  async getBetaUpdates() {
    return (await read({ kind: "betaUpdates" })) === true;
  },
  setBetaUpdates: (value: boolean) => write({ kind: "betaUpdates" }, value),
  async getAutoCheckUpdates() {
    return (await read({ kind: "autoCheckUpdates" })) === true;
  },
  setAutoCheckUpdates: (value: boolean) => write({ kind: "autoCheckUpdates" }, value),
  async getFavoriteGroup(account: string) {
    const name = await read({ kind: "favoriteGroup", account });
    return typeof name === "string" ? name : undefined;
  },
  setFavoriteGroup: (account: string, name: string) => write({ kind: "favoriteGroup", account }, name),
  async getShowAllFriends(account: string) {
    return (await read({ kind: "showAllFriends", account })) === true;
  },
  setShowAllFriends: (account: string, value: boolean) => write({ kind: "showAllFriends", account }, value),
};
