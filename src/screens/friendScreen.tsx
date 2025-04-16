import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { IoClose } from "react-icons/io5";

import { Avatar } from "@/components/ui/avatar";
import { useNavigate } from 'react-router';
import { Virtuoso } from "react-virtuoso";
import { commands } from "@/bindings";
import { LazyStore } from "@tauri-apps/plugin-store";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { getVersion } from "@tauri-apps/api/app";
import { toastError } from "@/components/toast.tsx";
import { Friend, Instance } from "@/libs/exportInterfaces.tsx";
import InstanceView from "@/components/ui/instance.tsx";
import { useTranslation } from "react-i18next";

export default function FriendScreen() {
  const isDev = import.meta.env.DEV;
  const [instancesData, setInstancesData] = useState<Instance[]>([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [onlineUserCount, setOnlineUserCount] = useState(0);
  const store = new LazyStore('store.json');
  const [isLoading, setIsLoading] = useState(false);
  const [appVersion, setAppVersion] = useState("unknown");
  const { t } = useTranslation();

  // データの保存
  const saveInstancesData = async (data: Instance[]) => {
    await store.set("instances-data", JSON.stringify(data));
    await store.save();
  };

  // データの復元
  const restoreInstancesData = async () => {
    const savedData = await store.get<string>("instances-data");
    if (savedData) {
      setInstancesData(JSON.parse(savedData));
    }
  };

  // userDataの保存
  const saveUserData = async (data: any) => {
    await store.set("user-data", JSON.stringify(data));
  };

  // userDataの復元
  const restoreUserData = async () => {
    const savedData = await store.get<string>("user-data");
    if (savedData) {
      setUserData(JSON.parse(savedData));
    }
  };

  useEffect(() => {
    async function init() {
      const version = await getVersion();
      setAppVersion(version);
      await restoreInstancesData();
      await restoreUserData();
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
        await store.delete("user-data");
        await store.save();
        setUserData(null);
        toastError(t(res.error.message));
      }
    }
    init();
    checkAuthToken();
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
    setInstancesData([]);
    setOnlineUserCount(0);
    setIsLoading(true);
    let getMaxCount = await store.get<number>("fetch-friends-count");
    if (!getMaxCount) {
      getMaxCount = 50;
    }
    for (let i: number = 0; ; i++) {
      const friends = await commands.getCurrentUserFriends(getMaxCount * i, getMaxCount, false);
      if (friends.status == "ok") {
        await loadInstances(friends.data);
        const friendNum: number = JSON.parse(friends.data).length;

        setOnlineUserCount((prev) => prev + friendNum)
        if (friendNum < getMaxCount) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        break;
      }
    }

    for (let i: number = 0; ; i++) {
      const friends = await commands.getCurrentUserFriends(getMaxCount * i, getMaxCount, true);
      if (friends.status == "ok") {
        await loadInstances(friends.data);
        const friendNum: number = JSON.parse(friends.data).length;

        if (friendNum < getMaxCount) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        break;
      }
    }

    setIsLoading(false);
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
      {/* Sidebar */}
      <div className="w-64 p-4 shadow-lg flex flex-col h-screen">
        <div className="flex items-center gap-2">
          {userData ? <Avatar src={userData.currentAvatarThumbnailImageUrl} className="w-10" /> : <></>}
          {userData ? <span className="text-lg font-semibold">{userData?.displayName}</span> : <span className="text-lg font-semibold">Not Login</span>}
        </div>
        <div className="mt-4 text-sm">
          {userData ? <>{t("sidebar.online")}: <span className="font-bold">{onlineUserCount}</span> / {userData?.friends.length}</> : <>{t("sidebar.offline")}</>}
        </div>
        <nav className="mt-4">
          <button className="btn btn-ghost w-full hover:bg-base-100" onClick={load}>{t("sidebar.reload")}</button>
        </nav>
        <nav className="mt-4">
          <button className="btn btn-ghost w-full hover:bg-base-100" onClick={() => navigate("/settings")}>{t("settings")}</button>
        </nav>
        {isDev &&
          <nav className="mt-4">
            <button className="btn btn-ghost w-full hover:bg-base-100" onClick={() => navigate("/debug")}>Debug</button>
          </nav>
        }
        <nav className="mt-4">
          <button className="btn btn-ghost w-full hover:bg-base-100" onClick={() => writeText(appVersion)}>v{appVersion}</button>
        </nav>
      </div>

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

        <progress className={`progress progress-info w-full ${!isLoading && "invisible"}`}></progress>

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