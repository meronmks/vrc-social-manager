import {FriendDetail} from "@/components/ui/dialogs/friendDetail.tsx"
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { useCallback } from "react";
import {Instance, InstanceDetailData} from "@/libs/exportInterfaces.tsx";
import {commands} from "@/bindings.ts";
import {toastError} from "@/components/toast.tsx";
import {InstanceDetail} from "@/components/ui/dialogs/instanceDetail.tsx";

type InstanceData = {
  instanceId: string;
  accessType: "Public" | "Friends+" | "Friends" | "Invite+" | "Invite" | "Group Public" | "Group+" | "Group" | "Private";
  instanceOwnerId?: string;
  region: string;
  nonce?: string;
  groupId?: string;
  groupAccessType?: string;
};

const parseInstanceString = (input: string): InstanceData => {
  const parts = input.split("~");
  const data: Partial<InstanceData> = { instanceId: "", accessType: "Public" };

  const firstPartMatch = parts[0].match(/^instanceId=([a-zA-Z0-9_-]+)$/);
  if (firstPartMatch) {
    data.instanceId = firstPartMatch[1];
  }

  let hasPrivate = false;
  let hasCanRequestInvite = false;
  let hasFriends = false;
  let hasHidden = false;
  let hasGroup = false;
  let groupType: string | null = null;

  parts.slice(1).forEach(part => {
    let match;

    if ((match = part.match(/^(private|friends|hidden)\((.+)\)$/))) {
      if (match[1] === "private") hasPrivate = true;
      if (match[1] === "friends") hasFriends = true;
      if (match[1] === "hidden") hasHidden = true;
      data.instanceOwnerId = match[2];
    } else if ((match = part.match(/^canRequestInvite$/))) {
      hasCanRequestInvite = true;
    } else if ((match = part.match(/^region\((.+)\)$/))) {
      data.region = match[1];
    } else if ((match = part.match(/^nonce\((.+)\)$/))) {
      data.nonce = match[1];
    } else if ((match = part.match(/^group\((.+)\)$/))) {
      hasGroup = true;
      data.groupId = match[1];
    } else if ((match = part.match(/^groupAccessType\((.+)\)$/))) {
      groupType = match[1];
    }
  });

  if (hasGroup) {
    if (groupType === "public") {
      data.accessType = "Group Public";
    } else if (groupType === "plus") {
      data.accessType = "Group+";
    } else if (groupType === "members") {
      data.accessType = "Group";
    }
  } else if (hasHidden) {
    data.accessType = "Friends+";
  } else if (hasFriends) {
    data.accessType = "Friends";
  } else if (hasPrivate) {
    data.accessType = hasCanRequestInvite ? "Invite+" : "Invite";
  } else if (input.toLowerCase() === "private" || input.toLowerCase() === "offline" || input.toLowerCase() === "traveling") {
    data.accessType = "Private"
  } else {
    data.accessType = "Public";
  }

  return data as InstanceData;
};

const showInstanceDetail = async (worldID: string, instanceID: string) => {
  const responce = await commands.getInstance(worldID, instanceID);
  const instanceLink: string = "https://vrchat.com/home/launch?worldId=" + worldID + "&instanceId=" + instanceID;
  if (responce.status == "ok") {
    console.log(JSON.stringify(JSON.parse(responce.data), null, 2))
    const jsonData = JSON.parse(responce.data) as InstanceDetailData;
    InstanceDetail.call({instance: jsonData, instanceLink: instanceLink});
  } else {
    toastError(responce.error.message);
  }
};

export default function InstanceView({ instance }: { instance: Instance }) {
  const getStatusColor = useCallback((status: any) => {
    switch (status) {
      case "join me":
        return "text-blue-500"
      case "active":
        return "text-green-500";
      case "ask me":
        return "text-orange-500";
      case "busy":
        return "text-red-500"
      case "offline":
        return "text-black";
      default:
        return "bg-white";
    }
  }, []);

  const instanceData: InstanceData = parseInstanceString("instanceId=" + instance.instanceId);

  return (
    <Card key={instance.id} className="mb-4">
      <div className="grid grid-cols-2 sticky top-0 z-10 p-2 bg-base-100/70 backdrop-blur-sm shadow-md">
        <img src={instance.thumbnail} alt={instance.worldId} className="w-full h-24 object-cover rounded-t-lg" />
        <div title={instance.name} className={`flex flex-col p-2 hover:bg-base-300 rounded-lg cursor-pointer ${!instanceData.instanceId && "pointer-events-none"}`} onClick={async () => await showInstanceDetail(instance.worldId, instance.instanceId)}>
          <h2 className="text-lg font-semibold truncate">{instance.name}</h2>
          {instanceData.instanceId &&
              <>
                <p>instanceID: {instanceData.instanceId}</p>
                <p>{instanceData.accessType}</p>
              </>
          }
        </div>
      </div>
      <CardContent>
        <div className="space-y-2">
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-2">
            {instance.friends.map((friend) => (
              <div key={friend.id} className="flex flex-col items-center p-2 hover:bg-base-300 rounded-lg cursor-pointer" onClick={() => FriendDetail.call({ friend: friend })}>
                <div className="indicator">
                  <span className={`indicator-item ${getStatusColor(friend.status)}`}>●</span>
                  <Avatar src={friend.avatar} className="w-10"/>
                </div>
                <span className="text-sm text-center">{friend.name} </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}