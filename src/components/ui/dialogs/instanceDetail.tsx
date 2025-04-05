import { InstanceDetailData } from '@/libs/exportInterfaces'
import { createCallable } from 'react-call'
import {useEffect, useState} from "react";
import {commands} from "@/bindings.ts";

interface Props { instance: InstanceDetailData, instanceLink: string }

export const InstanceDetail = createCallable<Props, void>(({ call, instance, instanceLink }) => {

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

    return(
        <div className="fixed inset-0 flex z-20 items-center justify-center" role="dialog">
            <div className="modal modal-open">
                <div className="modal-box">
                    <h2 title={instance.world.name} className="text-lg font-semibold truncate">{instance.world.name}</h2>
                    <div className="max-h-64 w-full overflow-x-auto overflow-y-auto">
                        <h3>World Info</h3>
                        <p>description: {instance.world.description}</p>

                        <h3>Instance Info</h3>
                        <p>InstanceID: {instance.name}</p>
                        <p>Type: {instance.type}</p>
                        <p>active: {String(instance.active)}</p>
                        <p>ageGate: {String(instance.ageGate)}</p>
                        <p>CanRequestInvite: {String(instance.canRequestInvite)}</p>
                        <p>Capacity: {instance.capacity}</p>
                        <p>User Count: {instance.userCount}</p>
                        <p>n_users: {instance.n_users}</p>
                        <p>InstanceOwner: {instanceOwnerName}</p>
                        <p>region: {instance.region}</p>
                        <p>photonRegion: {instance.photonRegion}</p>
                        <p>queueEnabled: {String(instance.queueEnabled)}</p>
                        <p>queueSize: {instance.queueSize}</p>
                    </div>
                    <div className="modal-action">
                        <a title={instance.world.name} href={instanceLink} target="_blank" className="btn btn-primary">Open Browser</a>
                        <button className="btn btn-primary" onClick={() => call.end()}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    )
})