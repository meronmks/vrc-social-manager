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
type Catalog = Record<"npm" | "cargo", PackageLicense[]>;

interface LicenseFile {
  npm: Record<string, { name: string; version: string; licenses?: string | string[]; licenseText?: string }>;
  cargo: { third_party_libraries: {
    package_name: string; package_version: string; license?: string; licenses?: { text?: string }[];
  }[] } | [];
}

function parseCatalog(raw: string): Catalog {
  const file: LicenseFile = JSON.parse(raw);
  const npm = Object.values(file.npm).map(p => ({
    name: p.name, version: p.version, license: Array.isArray(p.licenses) ? p.licenses.join(", ") : p.licenses,
    text: p.licenseText,
  }));
  const cargo = (Array.isArray(file.cargo) ? [] : file.cargo.third_party_libraries).map(p => ({
    name: p.package_name, version: p.package_version, license: p.license,
    text: p.licenses?.map(l => l.text).filter(Boolean).join("\n\n"),
  }));
  function sorted(rows: PackageLicense[]) {
    return rows.filter(p => p.name && p.version).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  }
  return { npm: sorted(npm), cargo: sorted(cargo) };
}

export default function LicensesScreen() {
  const t = useText();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [catalog, setCatalog] = useState<Catalog>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [source, setSource] = useState<keyof Catalog>("npm");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState("");
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
    return () => { live = false; };
  }, [attempt]);

  const search = query.trim().toLowerCase();
  const packages = catalog?.[source].filter(p => p.name.toLowerCase().includes(search));
  return (
    <section className="settings-page licenses-page" aria-labelledby="licenses-title">
      <button className="license-back" onClick={() => state?.fromSettings ? navigate(-1) : navigate("/settings", { replace: true })}>
        <FiArrowLeft aria-hidden="true" /> {t("設定に戻る", "Back to settings")}
      </button>
      <h1 id="licenses-title">{t("サードパーティライセンス", "Third-party licenses")}</h1>
      {failed ? (
        <div className="list-state warn" role="alert">
          {t("ライセンスを読み込めませんでした", "Could not load licenses")}
          <button className="quiet-action" onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>{t("再試行", "Retry")}</button>
        </div>
      ) : !catalog ? <p role="status">{t("ライセンスを読み込み中…", "Loading licenses…")}</p> : (
        <>
          <div className="license-tools">
            <div className="segmented" role="group" aria-label={t("パッケージの種類", "Package source")}>
              {(["npm", "cargo"] as const).map(key => (
                <button key={key} aria-pressed={source === key} onClick={() => { setSource(key); setExpanded(""); }}>
                  {key === "npm" ? "npm" : "Cargo"} ({catalog[key].length})
                </button>
              ))}
            </div>
            <label className="search-box">
              <FiSearch aria-hidden="true" />
              <input type="search" aria-label={t("パッケージ名で検索", "Search packages by name")}
                placeholder={t("パッケージ名で検索", "Search packages by name")} value={query}
                onChange={e => { setQuery(e.target.value); setExpanded(""); }} />
            </label>
          </div>
          <div className="license-list" key={source}>
            {packages?.length ? packages.map(p => {
              const key = p.name + "@" + p.version;
              return (
                <div className="license-item" key={key}>
                  <button className="license-row" aria-expanded={expanded === key} onClick={() => setExpanded(expanded === key ? "" : key)}>
                    <span><strong>{p.name}</strong> <small>v{p.version}</small></span>
                    <span className="license-id">{p.license || t("種類不明", "Unknown license")}</span>
                    <FiChevronDown aria-hidden="true" />
                  </button>
                  {expanded === key && <pre>{p.text || t("ライセンス本文は収録されていません", "License text is unavailable")}</pre>}
                </div>
              );
            }) : <p className="empty-text" role="status">{search ? t("一致するパッケージはありません", "No matching packages") : t("収録されたパッケージはありません", "No packages included")}</p>}
          </div>
        </>
      )}
    </section>
  );
}
