import { createCallable } from 'react-call'
import { Avatar } from "@/components/ui/avatar.tsx";
import { Friend } from "@/libs/exportInterfaces.tsx";

interface Props { friend: Friend }

const UNMOUNTING_DELAY = 300;

const getFriendStatus = (friend: Friend) => {
  switch (friend.status) {
    case "join me":
      return "bg-blue-500"
    case "active":
      return "bg-green-600";
    case "ask me":
      return "bg-orange-500";
    case "busy":
      return "bg-red-600"
    case "offline":
      return "bg-black";
    default:
      return "bg-white";
  }
};

export const FriendDetail = createCallable<Props, void>(({ call, friend }) => (
  <div className="fixed inset-0 flex z-20 items-center justify-center bg-black/50" role="dialog">
    <div className={`modal modal-open ${call.ended ? 'exit-animation' : ''}`}>
      <div className="modal-box max-w-2xl">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            <Avatar src={friend.avatar} className="w-32 h-32 rounded-lg shadow-lg" />
          </div>
          <div className="flex-grow">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">{friend.name}</h2>
              <div className="flex items-center gap-2">
                <span className={`badge ${getFriendStatus(friend)}`}>
                  {friend.status}
                </span>
                {friend.statusDescription && (
                  <div className="relative">
                    <div className="px-3 py-2 bg-base-200 text-sm rounded-lg shadow-sm flex items-center gap-2">
                      <span className="text-gray-500">💭</span>
                      <span>{friend.statusDescription}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>Platform:</span>
                <span className="font-medium">{friend.platform}</span>
              </div>
            </div>

            {friend.bioLinks && friend.bioLinks.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2">Links</h3>
                <div className="flex flex-wrap gap-2">
                  {friend.bioLinks.map((link, index) => (
                    <a
                      key={index}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {friend.bio && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Bio</h3>
            <div className="bg-base-200 rounded-lg p-4 max-h-[40vh] overflow-y-auto">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{friend.bio}</p>
            </div>
          </div>
        )}

        <div className="modal-action mt-6">
          <button 
            className="btn btn-primary"
            onClick={() => call.end()}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
), UNMOUNTING_DELAY)
