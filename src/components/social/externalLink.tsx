import { useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { FiExternalLink } from "react-icons/fi";
import { useText } from "@/libs/social";

// 既定のブラウザで開くリンク。http(s) 以外の URL は表示しない。
export function ExternalLink({ url, children }: { url: string; children: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  const t = useText();
  if (!/^https?:\/\//i.test(url)) return null;
  return (
    <>
      <a
        className="text-action"
        href={url}
        onClick={(e) => {
          e.preventDefault();
          setFailed(false);
          void open(url).catch(() => setFailed(true));
        }}
      >
        {children} <FiExternalLink aria-hidden />
      </a>
      {failed && <small role="alert">{t("ブラウザで開けませんでした", "Could not open the browser")}</small>}
    </>
  );
}
