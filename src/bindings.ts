
// This file was generated by [tauri-specta](https://github.com/oscartbeaumont/tauri-specta). Do not edit this file manually.

/** user-defined commands **/


export const commands = {
async login(userName: string, password: string) : Promise<Result<string, RustError>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("login", { userName, password }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async emailOtp(otp: string) : Promise<Result<boolean, RustError>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("email_otp", { otp }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async twoFactorAuth(otp: string) : Promise<Result<boolean, RustError>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("two_factor_auth", { otp }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async verifyAuthToken() : Promise<Result<boolean, RustError>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("verify_auth_token") };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async cookieClear() : Promise<void> {
    await TAURI_INVOKE("cookie_clear");
},
async getCurrentUserInfo() : Promise<Result<string, RustError>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("get_current_user_info") };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async getCurrentUserFriends(offset: number, n: number, offline: boolean) : Promise<Result<string, RustError>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("get_current_user_friends", { offset, n, offline }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async getWorldById(worldid: string) : Promise<Result<string, RustError>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("get_world_by_id", { worldid }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
},
async getRawWorldById(worldid: string) : Promise<Result<string, RustError>> {
    try {
    return { status: "ok", data: await TAURI_INVOKE("get_raw_world_by_id", { worldid }) };
} catch (e) {
    if(e instanceof Error) throw e;
    else return { status: "error", error: e  as any };
}
}
}

/** user-defined events **/



/** user-defined constants **/



/** user-defined types **/

export type RustError = { type: "Unrecoverable"; message: string }

/** tauri-specta globals **/

import {
	invoke as TAURI_INVOKE,
	Channel as TAURI_CHANNEL,
} from "@tauri-apps/api/core";
import * as TAURI_API_EVENT from "@tauri-apps/api/event";
import { type WebviewWindow as __WebviewWindow__ } from "@tauri-apps/api/webviewWindow";

type __EventObj__<T> = {
	listen: (
		cb: TAURI_API_EVENT.EventCallback<T>,
	) => ReturnType<typeof TAURI_API_EVENT.listen<T>>;
	once: (
		cb: TAURI_API_EVENT.EventCallback<T>,
	) => ReturnType<typeof TAURI_API_EVENT.once<T>>;
	emit: null extends T
		? (payload?: T) => ReturnType<typeof TAURI_API_EVENT.emit>
		: (payload: T) => ReturnType<typeof TAURI_API_EVENT.emit>;
};

export type Result<T, E> =
	| { status: "ok"; data: T }
	| { status: "error"; error: E };

function __makeEvents__<T extends Record<string, any>>(
	mappings: Record<keyof T, string>,
) {
	return new Proxy(
		{} as unknown as {
			[K in keyof T]: __EventObj__<T[K]> & {
				(handle: __WebviewWindow__): __EventObj__<T[K]>;
			};
		},
		{
			get: (_, event) => {
				const name = mappings[event as keyof T];

				return new Proxy((() => {}) as any, {
					apply: (_, __, [window]: [__WebviewWindow__]) => ({
						listen: (arg: any) => window.listen(name, arg),
						once: (arg: any) => window.once(name, arg),
						emit: (arg: any) => window.emit(name, arg),
					}),
					get: (_, command: keyof __EventObj__<any>) => {
						switch (command) {
							case "listen":
								return (arg: any) => TAURI_API_EVENT.listen(name, arg);
							case "once":
								return (arg: any) => TAURI_API_EVENT.once(name, arg);
							case "emit":
								return (arg: any) => TAURI_API_EVENT.emit(name, arg);
						}
					},
				});
			},
		},
	);
}
