import { useState, useMemo, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { IoClose } from "react-icons/io5";
import { Virtuoso } from "react-virtuoso";
import { commands } from "@/bindings";
import { getVersion } from "@tauri-apps/api/app";
import { toastError } from "@/components/toast.tsx";
import { Friend, Instance } from "@/libs/exportInterfaces.tsx";
import InstanceView from "@/components/ui/instance.tsx";
import { useTranslation } from "react-i18next";
import { Sidebar } from "@/components/ui/Sidebar";
import {logging} from "@/libs/logging.tsx";
import { userDataStore } from "@/libs/userDataStore";

export default function FriendScreen() {
  const isDev = import.meta.env.DEV;
  const [instancesData, setInstancesData] = useState<Instance[]>([]);
  const [search, setSearch] = useState("");
  const [userData, setUserData] = useState<any>(null);
  const [onlineUserCount, setOnlineUserCount] = useState(0);
  const [offlineUserCount, setOfflineUserCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [appVersion, setAppVersion] = useState("unknown");
  const { t } = useTranslation();
  const abortControllerRef = useRef<AbortController>(null);

  // データの保存
  const saveInstancesData = async (data: Instance[]) => {
    await userDataStore.setInstancesData(JSON.stringify(data));
  };

  // データの復元
  const restoreInstancesData = async () => {
    const savedData = await userDataStore.getInstancesData();
    if (savedData) {
      setInstancesData(JSON.parse(savedData));
    }
  };

  // userDataの保存
  const saveUserData = async (data: any) => {
    await userDataStore.addOrUpdateUser(data.id, data.displayName, data);
    await userDataStore.setCurrentUser(data.id);
  };

  // userDataの復元
  const restoreUserData = async (): Promise<boolean> => {
    try {
      const savedData = await userDataStore.getCurrentUser();
      if (savedData) {
        // savedData.userDataが文字列の場合はパース、オブジェクトの場合はそのまま使用
        const parsedData = typeof savedData.userData === 'string' 
          ? JSON.parse(savedData.userData) 
          : savedData.userData;
        setUserData(parsedData);
        return true;
      }
    } catch (error) {
      await logging.error(`Failed to restore user data: ${error}`);
      setUserData(null);
    }
    return false;
  };

  useEffect(() => {
    async function init() {
      const version = await getVersion();
      setAppVersion(version);
      await restoreInstancesData();
      const result = await restoreUserData();
      if (result) {
        await checkAuthToken();
      }
    }
    async function checkAuthToken() {
      const res = await commands.verifyAuthToken();
      if (res.status == "ok") {
        const currentUser = await commands.getCurrentUserInfo();
        if (currentUser.status == "ok") {
          const parsedUserData = JSON.parse(currentUser.data);
          setUserData(parsedUserData);
          await saveUserData(parsedUserData);
        }
      } else {
        await userDataStore.removeUser(await userDataStore.getCurrentUserId() || "");
        setUserData(null);
        toastError(t(res.error.message));
      }
    }
    init();
  }, []);

  useEffect(() => {
    return () => {
      // コンポーネントのアンマウント時に実行中の処理を中断
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // instancesDataが更新されたときに保存
  useEffect(() => {
    if (instancesData.length > 0) {
      saveInstancesData(instancesData);
    }
  }, [instancesData]);

  const filteredInstances = useMemo(() =>
    instancesData.map((instance) => ({
      ...instance,
      friends: instance.friends.filter((friend) =>
        friend.name.toLowerCase().includes(search.toLowerCase()) ||
        instance.name.toLowerCase().includes(search.toLowerCase())
      ),
    })).filter(instance => instance.friends.length > 0)
      .sort((a, b) => {
        // APIでオンラインユーザだけ取得を試みてもofflineで帰ってくるやつらがいる（Webだけ見てるとかの判定用と思われる）
        if (a.id.toLowerCase() === "offline") return 1;
        if (b.id.toLowerCase() === "offline") return -1;

        if (a.id.toLowerCase() === "web_or_mobile") return 1;
        if (b.id.toLowerCase() === "web_or_mobile") return -1;

        if (a.id.toLowerCase() === "private") return 1;
        if (b.id.toLowerCase() === "private") return -1;

        if (a.id.toLowerCase() === "traveling") return 1;
        if (b.id.toLowerCase() === "traveling") return -1;

        return b.friends.length - a.friends.length;
      }),
    [search, instancesData, onlineUserCount]);

  const load = async () => {
    // 既存の処理が実行中の場合は中断
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setInstancesData([]);
    setOnlineUserCount(0);
    setOfflineUserCount(0);
    setIsLoading(true);

    try {
      let getMaxCount = await userDataStore.getFetchFriendsCount();
      if (!getMaxCount) {
        getMaxCount = 50;
      }

      // オンラインユーザーの取得
      let onlineOffset = 0;
      for (let i: number = 0; ; i++) {
        if (signal.aborted) {
          return;
        }

        const friends = await commands.getCurrentUserFriends(onlineOffset, getMaxCount, false);
        if (friends.status == "ok") {
          await loadInstances(friends.data);
          const friendNum: number = JSON.parse(friends.data).length;

          setOnlineUserCount((prev) => prev + friendNum);
          onlineOffset += friendNum;
          // ページングが絶妙に壊れてる？仕様？なのか完全に0が返ってくるまで続きのページが存在する可能性がある
          if (friendNum === 0) break;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          await logging.error(`Error fetching online friends:${friends.error}`);
          break;
        }
      }

      // オフラインユーザーの取得
      let offlineOffset = 0;
      for (let i: number = 0; ; i++) {
        if (signal.aborted) {
          return;
        }

        const friends = await commands.getCurrentUserFriends(offlineOffset, getMaxCount, true);
        if (friends.status == "ok") {
          await loadInstances(friends.data);
          const friendNum: number = JSON.parse(friends.data).length;

          setOfflineUserCount((prev) => prev + friendNum);
          offlineOffset += friendNum;
          // ページングが絶妙に壊れてる？仕様？なのか完全に0が返ってくるまで続きのページが存在する可能性がある
          if (friendNum === 0) break;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          await logging.error(`Error fetching offline friends:${friends.error}`);
          break;
        }
      }
    } catch (error) {
      if (!signal.aborted) {
        await logging.error(`Error loading data:${error}`);
      }
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  const loadInstances = async (data: string) => {
    const friendList = JSON.parse(data);

    const newInstances = await Promise.all(friendList.map(async (friend: any) => {
      let instanceId = friend.location;
      const splitW = instanceId.split(":");
      let worldId = splitW[0];
      const instanceDetail = splitW[1] || "";

      if (worldId === "offline" && friend.status !== "offline") {
        instanceId = "web_or_mobile";
        worldId = "web_or_mobile";
      }

      const worldRes = await commands.getWorldById(worldId);
      let worldName = worldId;
      let worldThumbnail = "";

      if (worldRes.status === "ok") {
        const worldJson = JSON.parse(worldRes.data);
        worldName = worldJson.name;
        worldThumbnail = worldJson.thumbnailImageUrl;
      }

      return {
        id: instanceId,
        worldId,
        instanceId: instanceDetail,
        name: worldName,
        thumbnail: worldThumbnail,
        friends: [{
          id: friend.id,
          name: friend.displayName,
          avatar: friend.imageUrl,
          status: friend.status,
          location: friend.location,
          bio: friend.bio,
          statusDescription: friend.statusDescription,
          platform: friend.platform,
          bioLinks: friend.bioLinks,
        }],
      };
    }));

    setInstancesData((prev) => {
      const updatedInstances = [...prev];

      newInstances.forEach((newInstance) => {
        let existingInstance = updatedInstances.find(i => i.id === newInstance.id);

        if (existingInstance) {
          newInstance.friends.forEach((newFriend: Friend) => {
            if (!existingInstance!.friends.some(f => f.id === newFriend.id)) {
              existingInstance!.friends.push(newFriend);
            }
          });
        } else {
          updatedInstances.push(newInstance);
        }
      });

      return updatedInstances;
    });
  };

  return (
    <div className="flex min-h-screen bg-base-300">
      <Sidebar 
        userData={userData}
        onlineUserCount={onlineUserCount}
        offlineUserCount={offlineUserCount}
        appVersion={appVersion}
        load={load}
        isDev={isDev}
        isLoading={isLoading}
      />

      {/* Main Content */}
      <div className="flex-1 p-4 flex flex-col h-screen overflow-hidden">
        {/* Search Bar */}
        <div className="relative w-full mb-4">
          <Input
            className="w-full pr-10"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-secondary-content cursor-pointer p-1 rounded-full hover:bg-secondary transition-colors"
              onClick={() => setSearch("")}
            >
              <IoClose size={20} />
            </button>
          )}
        </div>
        {/* Friend List by Instance */}
        <div className="flex-1 overflow-y-auto">
          <Virtuoso
            totalCount={filteredInstances.length}
            itemContent={(index) => (
              <InstanceView instance={filteredInstances[index]} />
            )}
          />
        </div>
      </div>
    </div>
  );
}