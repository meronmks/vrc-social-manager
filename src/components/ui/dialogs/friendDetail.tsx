import { createCallable } from 'react-call'
import {Avatar} from "@/components/ui/avatar.tsx";

interface Props { friend: Friend }

export interface Friend {
  id: string;
  name: string;
  status: string;
  avatar: string;
  location: string;
}

export const FriendDetail = createCallable<Props, void>(({ call,friend }) => (
    <div className="fixed inset-0 flex z-20 items-center justify-center">
      <div className="modal modal-open">
        <div className="modal-box">
          <h2 className="text-lg font-bold">{friend.name}</h2>
          <div className="flex flex-col items-center p-4">
            <Avatar src={friend.avatar} className="w-24"/>
            <p>Status: {friend.status}</p>
            <p>Instance: {friend.location}</p>
          </div>
          <div className="modal-action">
            <button className="btn btn-primary" onClick={() => call.end()}>Close</button>
          </div>
        </div>
      </div>
    </div>
))

