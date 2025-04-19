import { Avatar } from "@/components/ui/avatar";
import { useNavigate } from 'react-router';
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { IoMenu, IoClose, IoReload, IoSettings, IoBuild, IoInformation } from "react-icons/io5";
import { toastNormal } from "../toast";

interface SidebarProps {
  userData: any;
  onlineUserCount: number;
  appVersion: string;
  load: () => void;
  isDev?: boolean;
}

export function Sidebar({ userData, onlineUserCount, appVersion, load, isDev }: SidebarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const copyToClipboard = (text: string) => {
    writeText(text).then(() => {
      toastNormal(t("sidebar.copiedToClipboardVersion", { version: text }));
    });
  };

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 p-4 shadow-lg flex flex-col h-screen relative`}>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-4 top-4 bg-base-100 rounded-full p-2 shadow-lg hover:bg-base-200 transition-colors md:hidden"
      >
        {isCollapsed ? <IoMenu size={20} /> : <IoClose size={20} />}
      </button>

      <div className="flex items-center gap-2 overflow-hidden">
        {userData && <Avatar src={userData.currentAvatarThumbnailImageUrl} className={`${isCollapsed ? 'w-8' : 'w-10'}`} />}
        {!isCollapsed && (
          userData ? 
            <span className="text-lg font-semibold truncate">{userData?.displayName}</span> 
            : <span className="text-lg font-semibold">{t("settingScreen.loggedOut")}</span>
        )}
      </div>

      {!isCollapsed && (
        <div className="mt-4 text-sm">
          {userData ? (
            <>{t("sidebar.online")}: <span className="font-bold">{onlineUserCount}</span> / {userData?.friends.length}</>
          ) : (
            <>{t("sidebar.offline")}</>
          )}
        </div>
      )}

      <nav className="mt-4">
        <button 
          className={`btn btn-ghost w-full hover:bg-base-100 ${isCollapsed ? 'px-2' : ''} flex items-center justify-start gap-2`} 
          onClick={load}
          title={t("sidebar.reload")}
        >
          <IoReload size={20} />
          {!isCollapsed && <span>{t("sidebar.reload")}</span>}
        </button>
      </nav>

      <nav className="mt-4">
        <button 
          className={`btn btn-ghost w-full hover:bg-base-100 ${isCollapsed ? 'px-2' : ''} flex items-center justify-start gap-2`} 
          onClick={() => navigate("/settings")}
          title={t("settings")}
        >
          <IoSettings size={20} />
          {!isCollapsed && <span>{t("settings")}</span>}
        </button>
      </nav>

      {isDev && (
        <nav className="mt-4">
          <button 
            className={`btn btn-ghost w-full hover:bg-base-100 ${isCollapsed ? 'px-2' : ''} flex items-center justify-start gap-2`} 
            onClick={() => navigate("/debug")}
            title="Debug"
          >
            <IoBuild size={20} />
            {!isCollapsed && <span>Debug</span>}
          </button>
        </nav>
      )}

      <nav className="mt-4">
        <button 
          className={`btn btn-ghost w-full hover:bg-base-100 ${isCollapsed ? 'px-2' : ''} flex items-center justify-start gap-2`} 
          onClick={() => copyToClipboard(appVersion)}
          title={`v${appVersion}`}
        >
          <IoInformation size={20} />
          {!isCollapsed && <span>v{appVersion}</span>}
        </button>
      </nav>
    </div>
  );
}