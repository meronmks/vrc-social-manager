import { Friend } from "@/components/friendDetailDialog"
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { useCallback } from "react";

export interface Instance {
  id: string;
  worldId: string;
  instanceId: string;
  name: string;
  thumbnail: string;
  friends: Friend[];
}

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

export default function InstanceView({ instance, callback }: { instance: Instance, callback: (friend: Friend) => void }) {
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
      default:
        return "text-black-500";
    }
  }, []);

  const instanceLink: string = "https://vrchat.com/home/launch?worldId=" + instance.worldId + "&instanceId=" + instance.instanceId;
  const instanceData: InstanceData = parseInstanceString("instanceId=" + instance.instanceId);

  return (
    <Card key={instance.id} className="mb-4">
      <div className="sticky top-0 z-10 p-2 bg-base-100/70 backdrop-blur-sm shadow-md">
        <img src={instance.thumbnail} alt={instance.worldId} className="w-full h-24 object-cover rounded-t-lg" />
        <a href={instanceLink} target="_blank" className="p-2 rounded-lg hover:bg-base-300 block">
          <h2 className="text-lg font-semibold">{instance.name}</h2>
          <p>instanceID: {instanceData.instanceId}</p>
          <p>instanceAccessLevel: {instanceData.accessType}</p>
        </a>
      </div>
      <CardContent>
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2">
            {instance.friends.map((friend) => (
              <div key={friend.id} className="flex flex-col items-center p-2 hover:bg-base-300 rounded-lg cursor-pointer" onClick={() => callback(friend)}>
                <div className="indicator">
                  <span className={`indicator-item ${getStatusColor(friend.status)}`}>●</span>
                  <Avatar src={friend.avatar}/>
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