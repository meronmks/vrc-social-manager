import { useState } from "react";
import { useNavigate } from "react-router";
import { commands } from "@/bindings";

export default function DebugScreen() {
  const navigate = useNavigate();
  const [currentUserFriendsData, setCurrentUserFriendsData] = useState<any>(null);
  const [currentUserInfoData, setCurrentUserInfoData] = useState<any>(null);
  const [worldID, setWorldID] = useState("wrld_bc647b75-363d-40ed-ac02-c576098a1efc");
  const [worldByIdData, setWorldByIdData] = useState<any>(null);
  const [instanceID, setInstanceID] = useState("");
  const [instanceData, setInstanceData] = useState<any>(null);

  const [method, setMethod] = useState<string>("GET");
  const [endpoint, setEndpoint] = useState<string>("/1/auth/user");
  const [requestData, setRequestData] = useState<string>("");
  const [apiResponse, setApiResponse] = useState<string>("");

  const sendCustomRequest = async () => {
    try {
      let data: string | undefined = undefined;
      if (requestData.trim()) {
        try {
          JSON.parse(requestData);
          data = requestData.trim();
        } catch (e) {
          setApiResponse("Invalid JSON in request data");
          return;
        }
      }

      const result = await commands.debugApiRequest({
        method,
        endpoint,
        data
      });

      if (result.status === "error") {
        setApiResponse(`Error: ${result.error.message}`);
        return;
      }

      try {
        const parsed = JSON.parse(result.data.data);
        setApiResponse(JSON.stringify(parsed, null, 2));
      } catch {
        setApiResponse(result.data.data);
      }
    } catch (error) {
      setApiResponse(error instanceof Error ? error.message : String(error));
    }
  };

  const getCurrentUserFriends = async () => {
    const dd = await commands.getCurrentUserFriends(0, 10, false);

    if (dd.status == "ok") {
      setCurrentUserFriendsData(JSON.stringify(JSON.parse(dd.data), null, 2));
    } else {
      setCurrentUserFriendsData(dd.error.message);
    }
  };

  const getCurrentUserInfo = async () => {
    const dd = await commands.getCurrentUserInfo();
    if (dd.status == "ok") {
      setCurrentUserInfoData(JSON.stringify(JSON.parse(dd.data), null, 2));
    } else {
      setCurrentUserInfoData(dd.error.message);
    }
  };

  const getWorldById = async () => {
    const dd = await commands.getRawWorldById(worldID);
    if (dd.status == "ok") {
      setWorldByIdData(JSON.stringify(JSON.parse(dd.data), null, 2));
    } else {
      setWorldByIdData(dd.error.message);
    }
  };

  const getInstance = async () => {
    const dd = await commands.getInstance(worldID, instanceID);
    if (dd.status == "ok") {
      setInstanceData(JSON.stringify(JSON.parse(dd.data), null, 2));
    } else {
      setInstanceData(dd.error.message);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-base-200 p-4 overflow-y-auto">
      <h1 className="text-xl font-semibold mb-4">Debug</h1>
      <button className="btn btn-outline mt-4" onClick={() => navigate("/")}>Back to Home</button>
      <h2 className="sticky top-0 z-10 text-lg font-semibold bg-base-100">API Test</h2>

      <div className="divider divider-accent">Custom API Request</div>
      <div className="flex flex-col gap-2">
        <select 
          className="select select-bordered w-full"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
        <input
          type="text"
          className="input input-bordered w-full"
          placeholder="/1/auth/user"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
        />
        <textarea
          className="textarea textarea-bordered w-full h-32"
          placeholder="Request Data (JSON)"
          value={requestData}
          onChange={(e) => setRequestData(e.target.value)}
        />
        <button className="btn btn-primary" onClick={sendCustomRequest}>Send Request</button>
      </div>
      <pre className="min-h-64 max-h-64 w-full overflow-x-auto overflow-y-auto p-2 bg-base-300 rounded-md mt-2">{apiResponse}</pre>

      <div className="divider divider-accent">getCurrentUserFriends</div>
      <button className="btn btn-primary mt-4" onClick={async () => await getCurrentUserFriends()}>Send</button>
      <pre className="min-h-64 max-h-64 w-full overflow-x-auto overflow-y-auto p-2 bg-base-300 rounded-md">{currentUserFriendsData}</pre>

      <div className="divider divider-accent">getCurrentUserInfo</div>
      <button className="btn btn-primary mt-4" onClick={async () => await getCurrentUserInfo()}>Send</button>
      <pre className="min-h-64 max-h-64 w-full overflow-x-auto overflow-y-auto p-2 bg-base-300 rounded-md">{currentUserInfoData}</pre>

      <div className="divider divider-accent">getWorldById</div>
      <input
        type="text"
        inputMode="text"
        className="input input-bordered w-full mt-2"
        placeholder={worldID}
        value={worldID}
        onChange={(e) => setWorldID(e.target.value)}
      />
      <button className="btn btn-primary mt-4" onClick={async () => await getWorldById()}>Send</button>
      <pre className="min-h-64 max-h-64 w-full overflow-x-auto overflow-y-auto p-2 bg-base-300 rounded-md">{worldByIdData}</pre>

      <div className="divider divider-accent">getInstance</div>
      <input
        type="text"
        inputMode="text"
        className="input input-bordered w-full mt-2"
        placeholder={worldID}
        value={worldID}
        onChange={(e) => setWorldID(e.target.value)}
      />
      <input
        type="text"
        inputMode="text"
        className="input input-bordered w-full mt-2"
        placeholder="instanceID"
        value={instanceID}
        onChange={(e) => setInstanceID(e.target.value)}
      />
      <button className="btn btn-primary mt-4" onClick={async () => await getInstance()}>Send</button>
      <pre className="min-h-64 max-h-64 w-full overflow-x-auto overflow-y-auto p-2 bg-base-300 rounded-md">{instanceData}</pre>
    </div>
  );
}
