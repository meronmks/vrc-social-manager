import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { FiArrowLeft, FiChevronDown, FiSearch } from "react-icons/fi";
import { commands } from "@/bindings";
import { useText } from "@/libs/social";

interface PackageLicense {
  name: string;
  version: string;
  license?: string;
  text?: string;
}
type Source = "npm" | "cargo";
type Catalog = Record<Source, PackageLicense[]>;

// scripts/collect-licenses.js が生成するライセンス情報ファイルの形式。
interface LicenseFile {
  npm: Record<string, { name: string; version: string; licenses?: string | string[]; licenseText?: string }>;
  cargo:
    | {
        third_party_libraries: {
          package_name: string;
          package_version: string;
          license?: string;
          licenses?: { text?: string }[];
        }[];
      }
    | [];
}

function sorted(rows: PackageLicense[]) {
  return rows
    .filter((p) => p.name && p.version)
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

function parseCatalog(raw: string): Catalog {
  const file: LicenseFile = JSON.parse(raw);
  const npm = Object.values(file.npm).map((p) => ({
    name: p.name,
    version: p.version,
    license: Array.isArray(p.licenses) ? p.licenses.join(", ") : p.licenses,
    text: p.licenseText,
  }));
  const cargo = (Array.isArray(file.cargo) ? [] : file.cargo.third_party_libraries).map((p) => ({
    name: p.package_name,
    version: p.package_version,
    license: p.license,
    text: p.licenses
      ?.map((l) => l.text)
      .filter(Boolean)
      .join("\n\n"),
  }));
  return { npm: sorted(npm), cargo: sorted(cargo) };
}

// 同梱ライセンス情報を読み込む。retry で読み込みをやり直す。
function useLicenseCatalog() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const result = await commands.getLicenses();
        if (result.status !== "ok" || result.data.status !== "ok") throw new Error();
        if (live) setCatalog(parseCatalog(result.data.data));
      } catch {
        if (live) setFailed(true);
      }
    }
    void load();
    return () => {
      live = false;
    };
  }, [attempt]);
  function retry() {
    setFailed(false);
    setAttempt((n) => n + 1);
  }
  return { catalog, failed, retry };
}

// 設定のサブ画面。npm と Cargo のパッケージごとにライセンス本文を開いて読める。
export default function LicensesScreen() {
  const t = useText();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { catalog, failed, retry } = useLicenseCatalog();
  const [source, setSource] = useState<Source>("npm");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState("");

  const search = query.trim().toLowerCase();
  const packages = catalog?.[source].filter((p) => p.name.toLowerCase().includes(search));
  // 設定から開いたときは履歴を戻り、直接開いたときは設定へ置き換える。
  const back = () => (state?.fromSettings ? navigate(-1) : navigate("/settings", { replace: true }));
  return (
    <section className="settings-page licenses-page" aria-labelledby="licenses-title">
      <button className="license-back" onClick={back}>
        <FiArrowLeft aria-hidden="true" /> {t("設定に戻る", "Back to settings")}
      </button>
      <h1 id="licenses-title">{t("サードパーティライセンス", "Third-party licenses")}</h1>
      {failed ? (
        <div className="list-state error" role="alert">
          {t("ライセンスを読み込めませんでした", "Could not load licenses")}
          <button className="quiet-action" onClick={retry}>
            {t("再試行", "Retry")}
          </button>
        </div>
      ) : !catalog ? (
        <p role="status">{t("ライセンスを読み込み中…", "Loading licenses…")}</p>
      ) : (
        <>
          <div className="license-tools">
            <div className="segmented" role="group" aria-label={t("パッケージの種類", "Package source")}>
              {(["npm", "cargo"] as const).map((key) => (
                <button
                  key={key}
                  aria-pressed={source === key}
                  onClick={() => {
                    setSource(key);
                    setExpanded("");
                  }}
                >
                  {key === "npm" ? "npm" : "Cargo"} ({catalog[key].length})
                </button>
              ))}
            </div>
            <label className="search-box">
              <FiSearch aria-hidden="true" />
              <input
                type="search"
                aria-label={t("パッケージ名で検索", "Search packages by name")}
                placeholder={t("パッケージ名で検索", "Search packages by name")}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setExpanded("");
                }}
              />
            </label>
          </div>
          <div className="license-list" key={source}>
            {packages?.length ? (
              packages.map((p) => {
                const key = p.name + "@" + p.version;
                return (
                  <LicenseItem
                    key={key}
                    item={p}
                    expanded={expanded === key}
                    toggle={() => setExpanded(expanded === key ? "" : key)}
                  />
                );
              })
            ) : (
              <p className="empty-text" role="status">
                {search
                  ? t("一致するパッケージはありません", "No matching packages")
                  : t("収録されたパッケージはありません", "No packages included")}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function LicenseItem({ item, expanded, toggle }: { item: PackageLicense; expanded: boolean; toggle: () => void }) {
  const t = useText();
  return (
    <div className="license-item">
      <button className="license-row" aria-expanded={expanded} onClick={toggle}>
        <span>
          <strong>{item.name}</strong> <small>v{item.version}</small>
        </span>
        <span className="license-id">{item.license || t("種類不明", "Unknown license")}</span>
        <FiChevronDown aria-hidden="true" />
      </button>
      {expanded && <pre>{item.text || t("ライセンス本文は収録されていません", "License text is unavailable")}</pre>}
    </div>
  );
}
