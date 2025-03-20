import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { commands } from "@/bindings";

export default function DebugScreen() {
  const navigate = useNavigate();
  const [debugData, setDebugData] = useState<any>(null);

  useEffect(() => {
    async function loadTheme() {
      const res = await commands.verifyAuthToken();
      if (res.status == "ok") { 
        const dd = await commands.getCurrentUserFriends(0, 10, false);
        // const dd = await commands.getCurrentUserInfo();
        // const dd = await commands.getRawWorldById("wrld_bc647b75-363d-40ed-ac02-c576098a1efc");
        if (dd.status == "ok"){
            setDebugData(JSON.parse(dd.data));
          } 
      }
    }
    loadTheme();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-base-200 p-4">
        <h1 className="text-xl font-semibold mb-4">Debug</h1>
        <button className="btn btn-outline mt-4" onClick={() => navigate("/")}>Back to Home</button>
        <pre>{JSON.stringify(debugData, null, 2)}</pre>
    </div>
  );
}
