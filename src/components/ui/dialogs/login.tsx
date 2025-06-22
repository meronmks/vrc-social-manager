import { createCallable } from 'react-call'
import { useState } from 'react'
import { useTranslation } from "react-i18next"
import { commands } from "@/bindings"

interface Props {
  onLoginSuccess: () => void;
}

const UNMOUNTING_DELAY = 300;

export const Login = createCallable<Props, void>(({ call, onLoginSuccess }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");

  const handleLogin = async () => {
    setErrorMessage("");
    try {
      const res = await commands.login(email, password)
      if (res.status == "ok") {
        switch(res.data) {
          case "emailOtp":
          case "totp":
            setRequires2FA(true);
            setTwoFactorMethod(res.data);
            break;
          default:
            onLoginSuccess();
            call.end();
            break;
        }
      } else {
        setErrorMessage(t(res.error.message));
      }
    } catch {
      setErrorMessage(t("errors.unknown"));
    }
  }

  const handle2FAVerification = async () => {
    setErrorMessage("");
    try {
      const res = await commands.twoFactorAuth(twoFactorCode);
      if (res.status == "ok") {
        if (res.data) {
          onLoginSuccess()
          call.end()
        } else {
          setErrorMessage(t("errors.2faFail"));
        }
      } else {
        setErrorMessage(t(res.error.message));
      }
    } catch {
      setErrorMessage(t("errors.unknown"));
    }
  }

  const handleEmailOtpVerification = async () => {
    setErrorMessage("");
    try {
      const res = await commands.emailOtp(twoFactorCode);
      if (res.status == "ok") {
        if (res.data) {
          onLoginSuccess()
          call.end()
        } else {
          setErrorMessage(t("errors.2faFail"));
        }
      } else {
        setErrorMessage(t(res.error.message));
      }
    } catch {
      setErrorMessage(t("errors.unknown"));
    }
  }

  return (
    <div className="fixed inset-0 flex z-20 items-center justify-center" role="dialog">
      <div className={`modal modal-open ${call.ended ? 'exit-animation' : ''}`}>
        <div className="modal-box">
          <h2 className="text-lg font-semibold">{t("login.title")}</h2>
          <div role="alert" className="alert alert-warning">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p>{t("login.warnmes1")}</p>
              <p>{t("login.warnmes2")}</p>
              <p>{t("login.warnmes3")}</p>
            </div>
            
          </div>
          {errorMessage && 
            <div role="alert" className="alert alert-error">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                placeholder={t("login.username")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <input
                type="password"
                className="input input-bordered w-full mt-2"
                placeholder={t("login.password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <button className="btn btn-primary w-full mt-4" onClick={handleLogin}>{t("login.submit")}</button>
            </div>
          ) : (
            <div>
              <input
                type="text"
                className="input input-bordered w-full mt-2"
                placeholder="Enter 2FA Code"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" &&
                  (twoFactorMethod === "emailOtp" ? handleEmailOtpVerification() : handle2FAVerification())
                }
              />
              <button 
                className="btn btn-primary w-full mt-4" 
                onClick={twoFactorMethod === "emailOtp" ? handleEmailOtpVerification : handle2FAVerification}
              >
                {t("login.submit2FA")}
              </button>
            </div>
          )}
          <button className="btn btn-secondary w-full mt-4" onClick={() => call.end()}>Cancel</button>
        </div>
      </div>
    </div>
  )
}, UNMOUNTING_DELAY) 