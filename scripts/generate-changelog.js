#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

/**
 * CHANGELOGのUnreleasedセクションから指定バージョンの変更履歴を生成
 */
function generateChangelog(version, releaseDate = null) {
  const changelogPath = 'CHANGELOG.md';
  
  if (!fs.existsSync(changelogPath)) {
    console.error('CHANGELOG.md not found');
    process.exit(1);
  }

  const content = fs.readFileSync(changelogPath, 'utf8');
  const lines = content.split('\n');
  
  // Unreleasedセクションの変更内容を抽出
  const unreleased = extractUnreleasedChanges(lines);
  
  if (!unreleased.hasChanges) {
    console.log('No changes found in Unreleased section');
    return;
  }

  // 新しいバージョンエントリを作成
  const newVersionEntry = createVersionEntry(version, releaseDate, unreleased);
  
  // CHANGELOGを更新
  updateChangelog(lines, version, newVersionEntry, unreleased);
  
  // リリースボディ用のMarkdownを生成
  generateReleaseBody(version, unreleased);
}

/**
 * Unreleasedセクションの変更内容を抽出
 */
function extractUnreleasedChanges(lines) {
  const changes = {
    added: [],
    changed: [],
    deprecated: [],
    removed: [],
    fixed: [],
    security: [],
    hasChanges: false
  };

  let currentSection = null;
  let inUnreleased = false;
  
  for (const line of lines) {
    if (line.startsWith('## [Unreleased]')) {
      inUnreleased = true;
      continue;
    }
    
    if (inUnreleased && line.startsWith('## [')) {
      // 次のバージョンセクションに到達したら終了
      break;
    }
    
    if (inUnreleased) {
      if (line.startsWith('### Added')) {
        currentSection = 'added';
      } else if (line.startsWith('### Changed')) {
        currentSection = 'changed';
      } else if (line.startsWith('### Deprecated')) {
        currentSection = 'deprecated';
      } else if (line.startsWith('### Removed')) {
        currentSection = 'removed';
      } else if (line.startsWith('### Fixed')) {
        currentSection = 'fixed';
      } else if (line.startsWith('### Security')) {
        currentSection = 'security';
      } else if (line.startsWith('- ') && currentSection) {
        changes[currentSection].push(line);
        changes.hasChanges = true;
      }
    }
  }
  
  return changes;
}

/**
 * 新しいバージョンエントリを作成
 */
function createVersionEntry(version, releaseDate, changes) {
  const date = releaseDate || new Date().toISOString().split('T')[0];
  let entry = [`## [${version}] - ${date}`, ''];
  
  if (changes.added.length > 0) {
    entry.push('### Added', ...changes.added, '');
  }
  
  if (changes.changed.length > 0) {
    entry.push('### Changed', ...changes.changed, '');
  }
  
  if (changes.deprecated.length > 0) {
    entry.push('### Deprecated', ...changes.deprecated, '');
  }
  
  if (changes.removed.length > 0) {
    entry.push('### Removed', ...changes.removed, '');
  }
  
  if (changes.fixed.length > 0) {
    entry.push('### Fixed', ...changes.fixed, '');
  }
  
  if (changes.security.length > 0) {
    entry.push('### Security', ...changes.security, '');
  }
  
  return entry;
}

/**
 * CHANGELOGファイルを更新
 */
function updateChangelog(lines, version, newVersionEntry, changes) {
  const newLines = [];
  let inUnreleased = false;
  let afterUnreleased = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('## [Unreleased]')) {
      // Unreleasedセクションをクリア
      newLines.push(line, '');
      newLines.push('### Added', '', '### Changed', '', '### Deprecated', '');
      newLines.push('### Removed', '', '### Fixed', '', '### Security', '');
      inUnreleased = true;
      continue;
    }
    
    if (inUnreleased && line.startsWith('## [')) {
      // Unreleasedの次のセクションに到達
      newLines.push(...newVersionEntry);
      newLines.push(line);
      inUnreleased = false;
      afterUnreleased = true;
      continue;
    }
    
    if (inUnreleased) {
      // Unreleasedセクション内はスキップ
      continue;
    }
    
    // リンクセクションを更新
    if (line.startsWith('[Unreleased]:')) {
      newLines.push(`[Unreleased]: https://github.com/meronmks/vrc-social-manager/compare/v${version}...HEAD`);
      newLines.push(`[${version}]: https://github.com/meronmks/vrc-social-manager/releases/tag/v${version}`);
      continue;
    }
    
    newLines.push(line);
  }
  
  // ファイルに書き込み
  fs.writeFileSync('CHANGELOG.md', newLines.join('\n'));
  console.log(`Updated CHANGELOG.md for version ${version}`);
}

/**
 * リリースボディ用のMarkdownファイルを生成
 */
function generateReleaseBody(version, changes) {
  let body = [];
  
  if (changes.added.length > 0) {
    body.push('### 🚀 New Features', ...changes.added.map(line => line.replace('- ', '* ')), '');
  }
  
  if (changes.changed.length > 0) {
    body.push('### 🔄 Changes', ...changes.changed.map(line => line.replace('- ', '* ')), '');
  }
  
  if (changes.fixed.length > 0) {
    body.push('### 🐛 Bug Fixes', ...changes.fixed.map(line => line.replace('- ', '* ')), '');
  }
  
  if (changes.deprecated.length > 0) {
    body.push('### ⚠️ Deprecated', ...changes.deprecated.map(line => line.replace('- ', '* ')), '');
  }
  
  if (changes.removed.length > 0) {
    body.push('### 🗑️ Removed', ...changes.removed.map(line => line.replace('- ', '* ')), '');
  }
  
  if (changes.security.length > 0) {
    body.push('### 🔒 Security', ...changes.security.map(line => line.replace('- ', '* ')), '');
  }
  
  const releaseBodyPath = `.release-body-${version}.md`;
  fs.writeFileSync(releaseBodyPath, body.join('\n'));
  console.log(`Generated release body: ${releaseBodyPath}`);
  
  return releaseBodyPath;
}

/**
 * gitログから変更履歴を自動生成（オプション機能）
 */
function generateFromGitLog(fromTag, toTag = 'HEAD') {
  try {
    const gitLog = execSync(`git log ${fromTag}..${toTag} --oneline --pretty=format:"%s"`, {encoding: 'utf8'});
    const commits = gitLog.split('\n').filter(line => line.trim());
    
    const changes = {
      added: [],
      changed: [],
      fixed: [],
      hasChanges: commits.length > 0
    };
    
    commits.forEach(commit => {
      if (commit.match(/^feat(\(.+\))?:/)) {
        changes.added.push(`- ${commit.replace(/^feat(\(.+\))?:\s*/, '')}`);
      } else if (commit.match(/^fix(\(.+\))?:/)) {
        changes.fixed.push(`- ${commit.replace(/^fix(\(.+\))?:\s*/, '')}`);
      } else if (commit.match(/^(chore|refactor|perf|style)(\(.+\))?:/)) {
        changes.changed.push(`- ${commit.replace(/^(chore|refactor|perf|style)(\(.+\))?:\s*/, '')}`);
      } else {
        changes.changed.push(`- ${commit}`);
      }
    });
    
    return changes;
  } catch (error) {
    console.error('Failed to generate from git log:', error.message);
    return null;
  }
}

// CLI実行
if (require.main === module) {
  const args = process.argv.slice(2);
  const version = args[0];
  const releaseDate = args[1];
  
  if (!version) {
    console.error('Usage: node generate-changelog.js <version> [release-date]');
    console.error('Example: node generate-changelog.js 1.0.0 2024-01-01');
    process.exit(1);
  }
  
  generateChangelog(version, releaseDate);
}

module.exports = { generateChangelog, generateFromGitLog };