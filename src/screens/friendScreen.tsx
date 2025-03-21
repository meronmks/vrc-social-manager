import {useState, useMemo, useEffect} from "react";
import { Input } from "@/components/ui/input";

import { Avatar } from "@/components/ui/avatar";
import { useNavigate } from 'react-router-dom';
import { Friend } from "@/components/friendDetailDialog"
import InstanceView, { Instance } from "@/components/ui/instance";
import { Virtuoso } from "react-virtuoso";
import { commands } from "@/bindings";
import { LazyStore } from "@tauri-apps/plugin-store";

export interface FriendScreenProps {
  onFriendSelect: (friend: Friend) => void;
}

export default function FriendScreen({ onFriendSelect }: FriendScreenProps) {
  const isDev = import.meta.env.DEV;
  const [instancesData, setInstancesData] = useState<Instance[]>([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [onlineUserCount, setOnlineUserCount] = useState(0);
  const store = new LazyStore('store.json');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function checkAuthToken() {
      const res = await commands.verifyAuthToken();
      if (res.status == "ok") {
        const currentUser = await commands.getCurrentUserInfo();
        if (currentUser.status == "ok") {
          setUserData(JSON.parse(currentUser.data));
        }
      }
    }

    checkAuthToken();
  }, []);

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

    setIsLoading(false);
  };

  const loadInstances = async (data: string) => {
    const friendList = JSON.parse(data);

    const newInstances = await Promise.all(friendList.map(async (friend: { location: any; id: any; displayName: any; imageUrl: any; status: any; }) => {
      const instanceId = friend.location;
      const splitW = instanceId.split(":");
      const worldId = splitW[0];
      const instanceDetail = splitW[1] || "";

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
          {userData ? <Avatar src={userData.currentAvatarThumbnailImageUrl} /> : <></>}
          {userData ? <span className="text-lg font-semibold">{userData?.displayName}</span> : <span className="text-lg font-semibold">Not Login</span>}
        </div>
        <div className="mt-4 text-sm">
          {userData ? <>Online: <span className="font-bold">{onlineUserCount}</span> / {userData?.friends.length}</> : <>Offline</>}
        </div>
        <nav className="mt-4">
          <button className="btn btn-ghost w-full hover:bg-base-100" onClick={load}>Reload</button>
        </nav>
        <nav className="mt-4">
          <button className="btn btn-ghost w-full hover:bg-base-100" onClick={() => navigate("/settings")}>Settings</button>
        </nav>
        {isDev &&
          <nav className="mt-4">
            <button className="btn btn-ghost w-full hover:bg-base-100" onClick={() => navigate("/debug")}>Debug</button>
          </nav>
        }
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 flex flex-col h-screen overflow-hidden">
        {/* Search Bar */}
        <Input
          className="w-full mb-4"
          placeholder="Search instances or friends..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        
        <progress className={`progress progress-info w-full ${!isLoading && "invisible"}`}></progress>

        {/* Friend List by Instance */}
        <div className="flex-1 overflow-y-auto">
          <Virtuoso
            totalCount={filteredInstances.length}
            itemContent={(index) => (
              <InstanceView instance={filteredInstances[index]} callback={onFriendSelect} />
            )}
          />
        </div>
      </div>
    </div>
  );
}