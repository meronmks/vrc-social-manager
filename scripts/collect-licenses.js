import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const require = createRequire(import.meta.url);
const checker = require('license-checker');
const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

async function getNpmLicenses() {
  return new Promise(async (resolve, reject) => {
    checker.init({
      start: dirname(__dirname),
      production: true,
      customFormat: {
        name: true,
        version: true,
        licenses: true,
        repository: true,
        publisher: true,
        copyright: true,
        licenseText: true
      }
    }, (err, packages) => {
      if (err) {
        reject(err);
      } else {
        const filteredPackages = {};
        for (const [pkgId, info] of Object.entries(packages)) {
          const [name] = pkgId.split('@');
          filteredPackages[pkgId] = {
            name: info.name || name,
            version: info.version,
            licenses: info.licenses,
            repository: info.repository,
            publisher: info.publisher,
            copyright: info.copyright,
            licenseText: info.licenseText
          };
        }
        resolve(filteredPackages);
      }
    });
  });
}

async function getCargoLicenses() {
  try {
    const { stdout } = await execAsync('cargo bundle-licenses --format json', {
      cwd: resolve(__dirname, '../src-tauri'),
      maxBuffer: 20 * 1024 * 1024
    });
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Failed to get Cargo licenses:', error);
    return [];
  }
}

async function main() {
  try {
    const [npmLicenses, cargoLicenses] = await Promise.all([
      getNpmLicenses(),
      getCargoLicenses()
    ]);

    const licenses = {
      npm: npmLicenses,
      cargo: cargoLicenses
    };

    const outputPath = resolve(__dirname, '../src/assets/licenses.json');
    await fs.mkdir(dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(licenses, null, 2));
    console.log('License information has been saved to:', outputPath);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();