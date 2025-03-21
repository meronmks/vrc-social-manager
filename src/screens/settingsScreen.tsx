import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LazyStore } from '@tauri-apps/plugin-store';
import { commands } from "@/bindings";

export default function SettingsScreen() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [theme, setTheme] = useState("");
  const loginDialog: HTMLDialogElement = document.getElementById('login_dialog') as HTMLDialogElement;
  const store = new LazyStore('store.json');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [fetchFriendsCount, setFetchFriendsCount] = useState(50);

  useEffect(() => {
    async function loadTheme() {
      const dataTheme = await store.get<string>("data-theme");
      if (dataTheme) {
        setTheme(dataTheme);
      }

      const ffc = await store.get<number>("fetch-friends-count");
      if (ffc) {
        setFetchFriendsCount(ffc);
      }

      const res = await commands.verifyAuthToken();
      if (res.status == "ok") {
        setIsLoggedIn(res.data);     
      } else {
        logout();
      }
    }
    loadTheme();
    setErrorMessage("");
  }, []);

  useEffect(() => {
    if (theme == "") return;
    store.set('data-theme', theme).then(() => store.save());
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const closeLoginDialog = () => {
    loginDialog.close();
    setErrorMessage("");
    setEmail("");
    setPassword("");
    setRequires2FA(false);
    setTwoFactorMethod("");
  };

  const handleLogin = async () => {
    setErrorMessage("");
    try {
      const res = await commands.login(email, password);
      if (res.status == "ok"){
        switch(res.data) {
          case "emailOtp":
          case "totp":
            setRequires2FA(true);
            setTwoFactorMethod(res.data);
            break;
          default:
            setIsLoggedIn(true);
            closeLoginDialog();
            break;
        }
      } else {
        setErrorMessage("ログインエラーが発生しました");
      }
    } catch {
      setErrorMessage("ログインエラーが発生しました");
    }
  };

  const handle2FAVerification = async () => {
    setErrorMessage("");
    try {
      const res = await commands.twoFactorAuth(twoFactorCode);
      if (res.status == "ok"){
        if (res.data) {
          setIsLoggedIn(true);
          closeLoginDialog();
        } else {
          setErrorMessage("2FAに失敗しました");
        }
      }
    } catch {
      setErrorMessage("ログインエラーが発生しました");
    }
  };

  const handleemailOtpVerification = async () => {
    setErrorMessage("");
    try {
      const res = await commands.emailOtp(twoFactorCode);
      if (res.status == "ok"){
        if (res.data) {
          setIsLoggedIn(true);
          closeLoginDialog();
        } else {
          setErrorMessage("2FAに失敗しました");
        }
      }
    } catch {
      setErrorMessage("ログインエラーが発生しました");
    }
  };

  const logout = () => {
    setErrorMessage("");
    setIsLoggedIn(false);
    setRequires2FA(false);
    commands.cookieClear();
  };

  return (
    <div className="flex flex-col h-screen bg-base-200 p-4">
      <h1 className="text-xl font-semibold mb-4">Settings</h1>
      <ul className="menu bg-base-100 p-2 rounded-box shadow-md w-full max-w-md">
        <li>
          {isLoggedIn ? (
            <div className="flex justify-between items-center w-full">
              <span>Logged in as User</span>
              <button className="btn btn-sm btn-error" onClick={() => {logout()}}>Logout</button>
            </div>
          ) : (
            <button className="btn btn-sm btn-primary w-full" onClick={() => loginDialog.showModal()}>Login</button>
          )}
        </li>
        <li>
          <div className="flex justify-between items-center w-full">
            <span>Theme</span>
            <button className="btn btn-sm" onClick={toggleTheme}>Switch {theme === "light" ? "Dark" : "Light"} Mode</button>
          </div>
        </li>
        <li>
          <div className="flex justify-between items-center w-full">
            <span>Fetch Friends Count</span>
            <input
              type="number"
              min="1"
              max="100"
              className="input input-bordered mt-2"
              placeholder="1-100"
              value={fetchFriendsCount}
              onChange={(e) => {
                const value = Number(e.target.value);
                setFetchFriendsCount(value);
                store.set("fetch-friends-count", value).then(() => store.save());
              }}
            />
          </div>
        </li>
      </ul>
      <button className="btn btn-outline mt-4" onClick={() => navigate("/")}>Back to Home</button>
      <dialog id="login_dialog" className="modal">
        <div className="modal-box">
          <h2 className="text-lg font-semibold">Login</h2>
          {errorMessage && 
            <div role="alert" className="alert alert-error">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          }
          {!requires2FA ? (
            <div>
              <input
                type="text"
                inputMode="email"
                autoComplete="username"
                className="input input-bordered w-full mt-2"
                placeholder="Email or Username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <input
                type="password"
                className="input input-bordered w-full mt-2"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <button className="btn btn-primary w-full mt-4" onClick={handleLogin}>Login</button>
            </div>
          ):(
            <div>
              <input
                type="text"
                className="input input-bordered w-full mt-2"
                placeholder="Enter 2FA Code"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" &&
                    (twoFactorMethod === "emailOtp" ? handleemailOtpVerification() : handle2FAVerification())
                }
              />
              { twoFactorMethod === "emailOtp" ? (
                <button className="btn btn-primary w-full mt-4" onClick={handleemailOtpVerification}>
                  Verify 2FA
                </button>
              ):(
                <button className="btn btn-primary w-full mt-4" onClick={handle2FAVerification}>
                  Verify 2FA
                </button>
              )}
            </div>
          )}
          <button className="btn btn-secondary w-full mt-4" onClick={closeLoginDialog}>Cancel</button>
        </div>
      </dialog>
    </div>
  );
}
