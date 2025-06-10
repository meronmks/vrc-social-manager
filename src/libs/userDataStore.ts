import { LazyStore } from '@tauri-apps/plugin-store';

export interface UserData {
    id: string;
    displayName: string;
    lastLogin: Date;
    userData: string;
}

class UserDataStore {
    private store: LazyStore;

    constructor() {
        this.store = new LazyStore('store.json');
    }

    async getTheme(): Promise<string> {
        const theme = await this.store.get<string>("data-theme");
        if (theme) {
            return theme;
        } else {
            // デフォルトテーマを設定
            await this.store.set('data-theme', "light");
            await this.store.save();
            return "light";
        }
    }

    async getFetchFriendsCount(): Promise<number> {
        const count = await this.store.get<number>("fetch-friends-count");
        if (count !== undefined) {
            return count;
        } else {
            // デフォルト値を設定
            await this.store.set("fetch-friends-count", 50);
            await this.store.save();
            return 50;
        }
    }

    async getAutoCheckUpdates(): Promise<boolean> {
        const autoCheck = await this.store.get<boolean>("auto-check-updates");
        if (autoCheck !== undefined) {
            return autoCheck;
        } else {
            // デフォルト値を設定
            await this.store.set("auto-check-updates", true);
            await this.store.save();
            return true;
        }
    }

    async getLanguage(): Promise<string> {
        const language = await this.store.get<string>("lang");
        if (language) {
            return language;
        } else {
            // デフォルト言語を設定
            await this.store.set("lang", "ja");
            await this.store.save();
            return "ja";
        }
    }

    async getInstancesData(): Promise<string> {
        const data = await this.store.get<string>("instances-data");
        if (data) {
            return data;
        } else {
            // デフォルト値を設定
            await this.store.set("instances-data", "[]");
            await this.store.save();
            return "[]";
        }
    }

    async getUsers(): Promise<UserData[]> {
        const savedUsers = await this.store.get<string>("users");
        if (savedUsers) {
            const parsedUsers = JSON.parse(savedUsers);
            return parsedUsers.map((user: any) => ({
                ...user,
                lastLogin: new Date(user.lastLogin)
            }));
        }
        return [];
    }

    async getCurrentUserId(): Promise<string | null> {
        return await this.store.get<string>("current-user-id") || null;
    }

    async setTheme(theme: string): Promise<void> {
        await this.store.set('data-theme', theme);
        await this.store.save();
    }

    async setFetchFriendsCount(count: number): Promise<void> {
        await this.store.set("fetch-friends-count", count);
        await this.store.save();
    }

    async setAutoCheckUpdates(autoCheck: boolean): Promise<void> {
        await this.store.set("auto-check-updates", autoCheck);
        await this.store.save();
    }

    async setLanguage(language: string): Promise<void> {
        await this.store.set("lang", language);
        await this.store.save();
    }

    async setInstancesData(data: string): Promise<void> {
        await this.store.set("instances-data", data);
        await this.store.save();
    }

    async addOrUpdateUser(id: string, displayName: string, userData: string): Promise<void> {
        const users = await this.getUsers();
        const updatedUsers = users.filter(user => user.id !== id);

        const newUser: UserData = {
            id,
            displayName,
            lastLogin: new Date(),
            userData
        };

        updatedUsers.push(newUser);
        await this.store.set("users", JSON.stringify(updatedUsers));
        await this.store.save();
    }

    async setCurrentUser(userId: string): Promise<void> {
        await this.store.set("current-user-id", userId);
        await this.store.save();
    }

    async removeUser(userId: string): Promise<void> {
        const users = await this.getUsers();
        const updatedUsers = users.filter(user => user.id !== userId);
        await this.store.set("users", JSON.stringify(updatedUsers));
        await this.store.save();
    }

    async getCurrentUser(): Promise<UserData | null> {
        const currentId = await this.getCurrentUserId();
        if (!currentId) return null;

        const users = await this.getUsers();
        return users.find(user => user.id === currentId) || null;
    }
}

export const userDataStore = new UserDataStore();
