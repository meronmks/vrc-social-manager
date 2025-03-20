export interface Friend {
  id: string;
  name: string;
  status: string;
  avatar: string;
  location: string;
}

export interface FriendDetailDialogProps {
  friend: Friend | null;
  onClose: () => void;
}

export default function FriendDetailDialog({ friend, onClose }: FriendDetailDialogProps) {
  return (
    <div className={`fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 transition-opacity ${friend ? "opacity-100 visible" : "opacity-0 invisible"}`}>
      <div className="modal modal-open">
        <div className="modal-box">
          <h2 className="text-lg font-bold">{friend?.name}</h2>
          <div className="flex flex-col items-center p-4">
            <img src={friend?.avatar} alt={friend?.name} className="w-24 h-24 rounded-full mb-4" />
            <p>Status: {friend?.status}</p>
            <p>Instance: {friend?.location}</p>
          </div>
          <div className="modal-action">
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
