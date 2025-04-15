import { InstanceDetailData } from '@/libs/exportInterfaces'
import { createCallable } from 'react-call'
import { useEffect, useState } from "react";
import { commands } from "@/bindings.ts";
import { FaUsers, FaGlobe, FaUser, FaServer, FaLock, FaMapMarkerAlt, FaQuestion } from 'react-icons/fa';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { toastNormal, toastError } from '@/components/toast';
import { useTranslation } from 'react-i18next';

interface Props { instance: InstanceDetailData, instanceLink: string }

const UNMOUNTING_DELAY = 300;

export const InstanceDetail = createCallable<Props, void>(({ call, instance, instanceLink }) => {

  const isDev = import.meta.env.DEV;
  const [instanceOwnerName, setInstanceOwnerName] = useState("Loading...");
  const { t } = useTranslation();

  useEffect(() => {
    async function getInstanceOwnerDetail() {
      let userid = "";
      if (instance.hidden) {
        userid = instance.hidden;
      } else if (instance.friends) {
        userid = instance.friends;
      } else if (instance.private) {
        userid = instance.private;
      } else {
        userid = instance.world.authorId;
      }
      const res = await commands.getUserById(userid);
      if (res.status == "ok") {
        setInstanceOwnerName(JSON.parse(res.data).displayName);
      } else {
        setInstanceOwnerName("Unknown")
      }
    }

    getInstanceOwnerDetail();
  }, []);

  const getInstanceTypeInfo = () => {
    switch (instance.type) {
      case 'hidden':
        return { icon: <FaUsers />, label: 'Friends+' };
      case 'friends':
        return { icon: <FaUser />, label: 'Friends' };
      case 'private':
        return { icon: <FaLock className="text-error" />, label: 'Private' };
      case 'group':
        switch (instance.groupAccessType) {
          case 'public':
            return { icon: <FaUsers />, label: 'Group Public' };
          case 'plus':
            return { icon: <FaUsers />, label: 'Group+' };
          case 'members':
            return { icon: <FaUser />, label: 'Group' };
          default:
            return { icon: <FaQuestion className="text-warning" />, label: 'Unknown' };
        }
      case 'public':
        return { icon: <FaGlobe />, label: 'Public' };
      default:
        return { icon: <FaQuestion className="text-warning" />, label: 'Unknown' };
    }
  };

  const getInstanceJson2Clipboard = async () => {
    const res = await commands.getInstance(instance.worldId, instance.instanceId);
    if (res.status == "ok") {
      writeText(res.data);
      toastNormal("JSONをクリップボードにコピーしました");
    }
  }

  const instanceTypeInfo = getInstanceTypeInfo();

  const inviteMyselfToInstance = async () => {
    const res = await commands.inviteMyselfToInstance(instance.worldId, instance.instanceId);
    if (res.status == "ok") {
      toastNormal(t("toast.selfInviteSuccess"));
    } else {
      toastError(t("toast.selfInviteFail"));
    }

  }

  return (
    <div className="fixed inset-0 flex z-20 items-center justify-center" role="dialog">
      <div className={`modal modal-open ${call.ended ? 'exit-animation' : ''}`}>
        <div className="modal-box max-w-3xl">
          <div className="flex justify-between items-center mb-4">
            <h2 title={instance.world.name} className="text-xl font-bold truncate flex items-center">
              <FaGlobe className="mr-2 text-primary" />
              {instance.world.name}
            </h2>
            <div className="badge badge-primary">{instanceTypeInfo.icon} {instanceTypeInfo.label}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h3 className="card-title text-lg flex items-center">
                  <FaGlobe className="mr-2" /> {t("instanceDetail.worldInfo")}
                </h3>
                <div className="divider my-1"></div>
                <div className="space-y-2">
                  <div className="flex items-start">
                    <span className="font-semibold min-w-32">{t("instanceDetail.description")}:</span>
                    <span className="text-sm">{instance.world.description || t("instanceDetail.noDescription")}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.authorName")}:</span>
                    <span className="text-sm">{instance.world.authorName || "不明"}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.popularity")}:</span>
                    <span className="text-sm">{instance.world.popularity || 0}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.visits")}:</span>
                    <span className="text-sm">{(instance.world.visits || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h3 className="card-title text-lg flex items-center">
                  <FaServer className="mr-2" /> {t("instanceDetail.instanceInfo")}
                </h3>
                <div className="divider my-1"></div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">ID:</span>
                    <span className="text-sm font-mono">{instance.name}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.status")}:</span>
                    <span className={`badge ${instance.active ? 'badge-success' : 'badge-error'}`}>
                      {instance.active ? t("instanceDetail.active") : t("instanceDetail.inactive")}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.ageGate")}:</span>
                    <span className={`badge ${instance.ageGate ? 'badge-warning' : 'badge-success'}`}>
                      {instance.ageGate ? t("instanceDetail.ageGateYes") : t("instanceDetail.ageGateNo")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h3 className="card-title text-lg flex items-center">
                  <FaLock className="mr-2" /> {t("instanceDetail.permissionsInfo")}
                </h3>
                <div className="divider my-1"></div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.drones")}:</span>
                    <span className={`badge ${instance.contentSettings?.drones ? 'badge-success' : 'badge-error'}`}>
                      {instance.contentSettings?.drones ? t("instanceDetail.allow") : t("instanceDetail.deny")}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.emoji")}:</span>
                    <span className={`badge ${instance.contentSettings?.emoji ? 'badge-success' : 'badge-error'}`}>
                      {instance.contentSettings?.emoji ? t("instanceDetail.allow") : t("instanceDetail.deny")}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.pedestals")}:</span>
                    <span className={`badge ${instance.contentSettings?.pedestals ? 'badge-success' : 'badge-error'}`}>
                      {instance.contentSettings?.pedestals ? t("instanceDetail.allow") : t("instanceDetail.deny")}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.prints")}:</span>
                    <span className={`badge ${instance.contentSettings?.prints ? 'badge-success' : 'badge-error'}`}>
                      {instance.contentSettings?.prints ? t("instanceDetail.allow") : t("instanceDetail.deny")}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.stickers")}:</span>
                    <span className={`badge ${instance.contentSettings?.stickers ? 'badge-success' : 'badge-error'}`}>
                      {instance.contentSettings?.stickers ? t("instanceDetail.allow") : t("instanceDetail.deny")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h3 className="card-title text-lg flex items-center">
                  <FaUsers className="mr-2" /> {t("instanceDetail.userInfo")}
                </h3>
                <div className="divider my-1"></div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.instanceOwner")}:</span>
                    <span className="text-sm">{instanceOwnerName}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.userCount")}:</span>
                    <span className="badge badge-primary">{instance.userCount}/{instance.capacity}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.platforms")}:</span>
                    <div className="flex gap-1">
                      <span className="badge badge-sm">PC: {instance.platforms?.standalonewindows || 0}</span>
                      <span className="badge badge-sm">Android: {instance.platforms?.android || 0}</span>
                      <span className="badge badge-sm">iOS: {instance.platforms?.ios || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h3 className="card-title text-lg flex items-center">
                  <FaMapMarkerAlt className="mr-2" /> {t("instanceDetail.otherInfo")}
                </h3>
                <div className="divider my-1"></div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.region")}:</span>
                    <span className="badge">{instance.region.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.photonRegion")}:</span>
                    <span className="badge">{instance.photonRegion.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">{t("instanceDetail.queue")}:</span>
                    <span className={`badge ${instance.queueEnabled ? 'badge-warning' : 'badge-success'}`}>
                      {instance.queueEnabled ? `${t("instanceDetail.queueEnabled", {queueSize:instance.queueSize})}` : t("instanceDetail.queueDisabled")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-action mt-4">
            {isDev &&
              <button className="btn btn-secondary" onClick={async () => await getInstanceJson2Clipboard()}>JSONをコピー</button>
            }
            <button className="btn btn-primary" onClick={async () => await inviteMyselfToInstance()}>{t("instanceDetail.inviteMe")}</button>
            <a title={instance.world.name} href={instanceLink} target="_blank" className="btn btn-primary">
              <FaGlobe className="mr-2" /> {t("instanceDetail.openInBrowser")}
            </a>
            <button className="btn btn-primary" onClick={() => call.end()}>{t("close")}</button>
          </div>
        </div>
      </div>
    </div>
  )
}, UNMOUNTING_DELAY)