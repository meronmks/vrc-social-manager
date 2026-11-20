import { useEffect, useRef, useState } from "react";
import { Account, isExpired, session } from "./social";
import { userDataStore } from "./userDataStore";

/** 画面上部に出すアカウントの問題。target がなければ登録一覧そのものを読めなかった */
export interface AccountProblem {
  target?: Account;
  reason: string;
}

interface Handlers {
  /** アカウントが使用中になったとき（画面を初期状態に戻す） */
  onActivate: () => void;
  /** ログアウトしたアカウントの情報を破棄するとき */
  onForget: (id: string) => void;
}

// 登録アカウントの読み込み・切り替え・ログアウトと、ログイン画面・問題表示の状態を管理する。
export function useAccounts(handlers: Handlers) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [active, setActive] = useState<Account>();
  // 非同期処理の完了時に「まだ使用中か」を判定するため、最新の使用中IDを ref でも持つ。
  const activeId = useRef<string | undefined>(undefined);
  // 切り替えのたびに増やし、フレンド画面を作り直す。
  const [epoch, setEpoch] = useState(0);
  const generation = useRef(0);
  /** ログイン画面の表示状態。target があればそのアカウントへの再ログイン */
  const [auth, setAuth] = useState<{ target?: Account }>();
  const [busy, setBusy] = useState(true);
  const [problem, setProblem] = useState<AccountProblem>();
  const lock = useRef(false);
  const latest = useRef(handlers);
  latest.current = handlers;

  function activate(account: Account) {
    activeId.current = account.id;
    setActive(account);
    setAccounts((prev) => [account, ...prev.filter((u) => u.id !== account.id)]);
    setAuth(undefined);
    setProblem(undefined);
    setEpoch(++generation.current);
    latest.current.onActivate();
  }

  async function activateSaved(account: Account) {
    try {
      activate(await session.switch(account.id));
    } catch (e) {
      setProblem({ target: account, reason: String(e) });
    }
  }

  // アカウント操作は同時に一つだけ実行する。
  async function exclusive(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function switchAccount(account: Account) {
    return exclusive(async () => {
      setAuth(undefined);
      setProblem(undefined);
      await activateSaved(account);
    });
  }

  async function boot(live: () => boolean) {
    setBusy(true);
    setProblem(undefined);
    try {
      const [list, id, theme] = await Promise.all([
        userDataStore.getUsers(),
        userDataStore.getCurrentUserId(),
        userDataStore.getTheme(),
      ]);
      if (!live()) return;
      document.documentElement.dataset.theme = theme;
      list.sort((a, b) => b.lastLogin.getTime() - a.lastLogin.getTime());
      setAccounts(list);
      const selected = list.find((u) => u.id === id) ?? list[0];
      if (selected) await switchAccount(selected);
      else {
        setAuth({});
        setBusy(false);
      }
    } catch {
      if (live()) {
        setProblem({ reason: "storage" });
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    let live = true;
    void boot(() => live);
    return () => {
      live = false;
    };
  }, []);

  // 使用中のアカウントからログアウトし、残りのアカウントがあればそちらへ切り替える。
  function logout() {
    const current = active;
    if (!current) return;
    return exclusive(async () => {
      try {
        await session.logout(current.id);
      } catch {
        setProblem({ target: current, reason: "storage" });
        return;
      }
      const rest = accounts.filter((u) => u.id !== current.id);
      setAccounts(rest);
      activeId.current = undefined;
      setActive(undefined);
      setAuth(undefined);
      setProblem(undefined);
      latest.current.onForget(current.id);
      if (rest[0]) await activateSaved(rest[0]);
      else setAuth({});
    });
  }

  // フレンド画面などが認証切れを検出したとき。切り替え後に届いた古い通知は無視する。
  function expire(id: string) {
    if (activeId.current === id && generation.current === epoch) setProblem({ target: active, reason: "http:401" });
  }

  // 問題表示のボタン。認証切れなら再ログイン、それ以外は読み込みをやり直す。
  function resolveProblem() {
    if (!problem) return;
    if (isExpired(problem.reason)) setAuth({ target: problem.target });
    else if (problem.target) void switchAccount(problem.target);
    else void boot(() => true);
  }

  // 使用中のアカウントが使えない間は、画面を隠して問題表示だけを出す。
  const gated = !!problem && (!active || (problem.target?.id === active.id && isExpired(problem.reason)));

  return {
    accounts,
    active,
    epoch,
    auth,
    busy,
    problem,
    gated,
    isActive: (id: string) => activeId.current === id,
    switchAccount,
    logout,
    expire,
    resolveProblem,
    dismissProblem: () => setProblem(undefined),
    startAuth: () => setAuth({}),
    cancelAuth: () => setAuth(undefined),
    activate,
  };
}
