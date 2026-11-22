import { Text, useText } from "@/libs/social";

type Flag = "us" | "eu" | "jp";
interface RegionInfo {
  flag: Flag;
  /** 同じ国旗を使うリージョンを見分けるための添え字（US の東西） */
  suffix?: string;
  label: string;
}

// VRChat のリージョン値を国旗・添え字・読み上げ用の名前に対応づける。
function regionInfo(region: string, t: Text): RegionInfo | undefined {
  switch (region) {
    case "us":
    case "usw":
      return { flag: "us", suffix: "W", label: t("米国西部", "US West") };
    case "use":
      return { flag: "us", suffix: "E", label: t("米国東部", "US East") };
    case "eu":
      return { flag: "eu", label: t("ヨーロッパ", "Europe") };
    case "jp":
      return { flag: "jp", label: t("日本", "Japan") };
  }
}

// 国旗の SVG。Windows は国旗の絵文字を表示できないため、小さく描いても判別できる程度に簡略化して自前で描く。
function FlagIcon({ flag }: { flag: Flag }) {
  switch (flag) {
    case "jp":
      return (
        <svg viewBox="0 0 15 10" aria-hidden="true">
          <rect width="15" height="10" fill="#fff" />
          <circle cx="7.5" cy="5" r="3" fill="#bc002d" />
        </svg>
      );
    case "eu":
      return (
        <svg viewBox="0 0 15 10" aria-hidden="true">
          <rect width="15" height="10" fill="#039" />
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * Math.PI) / 6;
            return (
              <circle key={i} cx={7.5 + 3.2 * Math.sin(angle)} cy={5 - 3.2 * Math.cos(angle)} r="0.55" fill="#fc0" />
            );
          })}
        </svg>
      );
    case "us":
      return (
        <svg viewBox="0 0 19 10" aria-hidden="true">
          <rect width="19" height="10" fill="#fff" />
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} y={(i * 2 * 10) / 13} width="19" height={10 / 13} fill="#b22234" />
          ))}
          <rect width="7.6" height={(7 * 10) / 13} fill="#3c3b6e" />
        </svg>
      );
  }
}

// インスタンスのリージョン表示。対応する国旗がない値はそのまま大文字で表示する。
export function RegionFlag({ region }: { region?: string }) {
  const t = useText();
  if (!region || region === "unknown") return null;
  const info = regionInfo(region, t);
  if (!info) return <span className="region">{region.toUpperCase()}</span>;
  return (
    <span className="region" title={info.label}>
      <FlagIcon flag={info.flag} />
      {info.suffix && <span aria-hidden="true">{info.suffix}</span>}
      <span className="sr-only">{info.label}</span>
    </span>
  );
}
