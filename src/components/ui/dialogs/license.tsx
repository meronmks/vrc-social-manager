import { useState, useEffect } from 'react';
import { createCallable } from 'react-call';
import { commands } from "@/bindings";
import { useTranslation } from "react-i18next";
import { logging } from "@/libs/logging.tsx";

interface License {
  name: string;
  version: string;
  licenses: string;
  licenseText: string;
  repository?: string;
  publisher?: boolean | string;
  email?: string;
  url?: string;
  copyright?: boolean | string;
}

interface Licenses {
  license: string;
  text: string;
}

interface CargoLicense {
  package_name: string;
  package_version: string;
  license: string;
  licenses: Licenses[];
  repository?: string;
  description: string;
}

interface LicenseData {
  npm: {
    [key: string]: {
      name: string;
      version: string;
      licenses: string;
      licenseText: string;
      repository?: string;
      publisher?: boolean | string;
      email?: string;
      url?: string;
      copyright?: boolean | string;
    };
  };
  cargo: {
    root_name: string;
    third_party_libraries: CargoLicense[];
  };
}

type LicenseType = 'npm' | 'cargo';

// ダイアログ用のProps（空でOK）
interface Props {}

const UNMOUNTING_DELAY = 300;

// ダイアログとして呼び出し可能なライセンス表示コンポーネント
export const ThirdPartyLicenses = createCallable<Props, void>(({ call }) => {
  const [licenses, setLicenses] = useState<{ npm: License[], cargo: License[] }>({ npm: [], cargo: [] });
  const [expandedLicense, setExpandedLicense] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LicenseType>('npm');
  const { t } = useTranslation();

  useEffect(() => {
    async function fetchLicenses() {
      try {
        const result = await commands.getLicenses();
        if (result.status === "ok" && result.data.status === "ok") {
          try {
            const jsonData = JSON.parse(result.data.data) as LicenseData;

            // NPMライセンスの処理
            const npmLicenses = Object.entries(jsonData.npm || {}).map(([, info]) => ({
              name: info.name,
              version: info.version,
              licenses: info.licenses || "Unknown",
              licenseText: info.licenseText || "License text not available"
            }));

            // Cargoライセンスの処理
            const cargoLicenses: License[] = [];
            if (jsonData.cargo?.third_party_libraries) {
              cargoLicenses.push(...jsonData.cargo.third_party_libraries.map(lib => ({
                name: lib.package_name || "",
                version: lib.package_version || "",
                licenses: lib.license || "Unknown",
                licenseText: lib.licenses.map(l => l.text).join("\n") || "License text not available"
              })));
            }

            // 空の名前やバージョンを除外し、名前でソート
            const filteredNpmLicenses = npmLicenses
              .filter(l => l.name && l.version)
              .sort((a: License, b: License) => a.name.localeCompare(b.name));

            const filteredCargoLicenses = cargoLicenses
              .filter(l => l.name && l.version)
              .sort((a: License, b: License) => a.name.localeCompare(b.name));

            setLicenses({
              npm: filteredNpmLicenses,
              cargo: filteredCargoLicenses
            });
          } catch (parseError) {
            await logging.error(`Failed to parse license data:${parseError}`);
            setLicenses({ npm: [], cargo: [] });
          }
        }
      } catch (error) {
        await logging.error(`Failed to fetch licenses:${error}`);
        setLicenses({ npm: [], cargo: [] });
      } finally {
        setIsLoading(false);
      }
    }
    fetchLicenses();
  }, []);

  const activeLicenses = licenses[activeTab] || [];

  return (
    <div className="fixed inset-0 flex z-20 items-center justify-center bg-black/50" role="dialog">
      <div className={`modal modal-open ${call.ended ? 'exit-animation' : ''}`}>
        <div className="modal-box max-w-3xl max-h-[80vh]">
          <h3 className="text-xl font-bold mb-4">{t("settingScreen.thirdPartyLicenses")}</h3>

          {isLoading ? (
            <div className="p-4 text-center">{t("loading")}</div>
          ) : (
            <div className="space-y-4">
              {/* タブ切り替え */}
              <div className="tabs tabs-boxed justify-center">
                <button
                  className={`tab ${activeTab === 'npm' ? 'tab-active' : ''} px-6`}
                  onClick={() => setActiveTab('npm')}
                >
                  {t("settingScreen.npmPackages")} ({licenses.npm.length})
                </button>
                <button
                  className={`tab ${activeTab === 'cargo' ? 'tab-active' : ''} px-6`}
                  onClick={() => setActiveTab('cargo')}
                >
                  {t("settingScreen.cargoPackages")} ({licenses.cargo.length})
                </button>
              </div>

              {/* ライセンス一覧 */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                {activeLicenses.map((license) => (
                  <div key={`${activeTab}-${license.name}-${license.version}`} className="collapse collapse-plus bg-base-200 rounded-lg">
                    <input
                      type="checkbox"
                      checked={expandedLicense === `${activeTab}-${license.name}-${license.version}`}
                      onChange={() => setExpandedLicense(expandedLicense === `${activeTab}-${license.name}-${license.version}` ? null : `${activeTab}-${license.name}-${license.version}`)}
                    />
                    <div className="collapse-title text-lg font-medium flex items-center gap-2">
                      <span className="flex-grow">{license.name} <span className="text-sm text-base-content/70">v{license.version}</span></span>
                      <span className="badge badge-primary shrink-0">{license.licenses}</span>
                    </div>
                    <div className="collapse-content">
                      <pre className="whitespace-pre-wrap text-sm bg-base-300 p-4 rounded-lg mt-2 overflow-auto max-h-64 break-words">
                        {license.licenseText}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 閉じるボタン */}
          <div className="modal-action">
            <button
              className="btn btn-primary"
              onClick={() => call.end()}
            >
              {t("close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}, UNMOUNTING_DELAY);
