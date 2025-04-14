import { InstanceDetailData } from '@/libs/exportInterfaces'
import { createCallable } from 'react-call'
import { useEffect, useState } from "react";
import { commands } from "@/bindings.ts";
import { FaUsers, FaGlobe, FaUser, FaServer, FaLock, FaMapMarkerAlt, FaQuestion } from 'react-icons/fa';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { toastNormal, toastError } from '@/components/toast';

interface Props { instance: InstanceDetailData, instanceLink: string }

const UNMOUNTING_DELAY = 300;

export const InstanceDetail = createCallable<Props, void>(({ call, instance, instanceLink }) => {

  const isDev = import.meta.env.DEV;
  const [instanceOwnerName, setInstanceOwnerName] = useState("Loading...");

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
      toastNormal("招待リクエストを送信しました");
    } else {
      toastError("招待リクエストを送信できませんでした");
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
                  <FaGlobe className="mr-2" /> ワールド情報
                </h3>
                <div className="divider my-1"></div>
                <div className="space-y-2">
                  <div className="flex items-start">
                    <span className="font-semibold min-w-32">説明:</span>
                    <span className="text-sm">{instance.world.description || "説明なし"}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">作者:</span>
                    <span className="text-sm">{instance.world.authorName || "不明"}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">人気度:</span>
                    <span className="text-sm">{instance.world.popularity || 0}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">訪問者数:</span>
                    <span className="text-sm">{(instance.world.visits || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h3 className="card-title text-lg flex items-center">
                  <FaServer className="mr-2" /> インスタンス情報
                </h3>
                <div className="divider my-1"></div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">ID:</span>
                    <span className="text-sm font-mono">{instance.name}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">ステータス:</span>
                    <span className={`badge ${instance.active ? 'badge-success' : 'badge-error'}`}>
                      {instance.active ? 'アクティブ' : '非アクティブ'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">年齢制限:</span>
                    <span className={`badge ${instance.ageGate ? 'badge-warning' : 'badge-success'}`}>
                      {instance.ageGate ? 'あり' : 'なし'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h3 className="card-title text-lg flex items-center">
                  <FaLock className="mr-2" /> 権限情報
                </h3>
                <div className="divider my-1"></div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">招待:</span>
                    <span className={`badge ${instance.canRequestInvite ? 'badge-success' : 'badge-error'}`}>
                      {instance.canRequestInvite ? '可能' : '不可'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">ドローン:</span>
                    <span className={`badge ${instance.contentSettings?.drones ? 'badge-success' : 'badge-error'}`}>
                      {instance.contentSettings?.drones ? '許可' : '禁止'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">絵文字:</span>
                    <span className={`badge ${instance.contentSettings?.emoji ? 'badge-success' : 'badge-error'}`}>
                      {instance.contentSettings?.emoji ? '許可' : '禁止'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">ペデスタル:</span>
                    <span className={`badge ${instance.contentSettings?.pedestals ? 'badge-success' : 'badge-error'}`}>
                      {instance.contentSettings?.pedestals ? '許可' : '禁止'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">プリント:</span>
                    <span className={`badge ${instance.contentSettings?.prints ? 'badge-success' : 'badge-error'}`}>
                      {instance.contentSettings?.prints ? '許可' : '禁止'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">ステッカー:</span>
                    <span className={`badge ${instance.contentSettings?.stickers ? 'badge-success' : 'badge-error'}`}>
                      {instance.contentSettings?.stickers ? '許可' : '禁止'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <h3 className="card-title text-lg flex items-center">
                  <FaUsers className="mr-2" /> ユーザー情報
                </h3>
                <div className="divider my-1"></div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">インスタンス所有者:</span>
                    <span className="text-sm">{instanceOwnerName}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">ユーザー数:</span>
                    <span className="badge badge-primary">{instance.userCount}/{instance.capacity}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">プラットフォーム:</span>
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
                  <FaMapMarkerAlt className="mr-2" /> その他情報
                </h3>
                <div className="divider my-1"></div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">リージョン:</span>
                    <span className="badge">{instance.region.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">Photon リージョン:</span>
                    <span className="badge">{instance.photonRegion.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold min-w-32">キュー:</span>
                    <span className={`badge ${instance.queueEnabled ? 'badge-warning' : 'badge-success'}`}>
                      {instance.queueEnabled ? `有効 (${instance.queueSize}人待機中)` : '無効'}
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
            <button className="btn btn-primary" onClick={async () => await inviteMyselfToInstance()}>自分に招待を送る</button>
            <a title={instance.world.name} href={instanceLink} target="_blank" className="btn btn-primary">
              <FaGlobe className="mr-2" /> ブラウザで開く
            </a>
            <button className="btn btn-primary" onClick={() => call.end()}>閉じる</button>
          </div>
        </div>
      </div>
    </div>
  )
}, UNMOUNTING_DELAY)