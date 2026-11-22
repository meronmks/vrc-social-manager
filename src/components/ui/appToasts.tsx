import { FiAlertTriangle, FiBell, FiX } from "react-icons/fi";
import { Slide, ToastContainer, type CloseButtonProps, type IconProps } from "react-toastify";
import { useText } from "@/libs/social";

// 通知の種類に合わせたアイコン。ヘッダーの通知履歴と同じものを使う。
export function NoticeIcon({ error }: { error?: boolean }) {
  return error ? <FiAlertTriangle /> : <FiBell />;
}

function ToastIcon({ type }: IconProps) {
  return <NoticeIcon error={type === "error" || type === "warning"} />;
}

function ToastClose({ closeToast }: CloseButtonProps) {
  const t = useText();
  return (
    <button className="app-toast-close" aria-label={t("閉じる", "Close")} onClick={closeToast}>
      <FiX />
    </button>
  );
}

// アプリの配色に合わせたトースト表示（見た目は styles.css の .app-toast）。
export function AppToasts() {
  return (
    <ToastContainer
      position="top-right"
      transition={Slide}
      hideProgressBar
      // 通知は履歴から見返せるため、ホバー中やウィンドウ非アクティブ時も止めずに閉じる。
      pauseOnHover={false}
      pauseOnFocusLoss={false}
      limit={4}
      icon={ToastIcon}
      closeButton={(props) => <ToastClose {...props} />}
      toastClassName="app-toast"
    />
  );
}
