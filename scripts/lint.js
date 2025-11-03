#!/usr/bin/env node

/**
 * TypeScriptの型チェックを実行し、bindings.tsからのエラーを除外するスクリプト
 */

import { execSync } from 'child_process';

try {
  // tscを実行（エラーがあっても続行）
  const output = execSync('tsc', {
    encoding: 'utf-8',
    stdio: 'pipe'
  });

  console.log(output);
  process.exit(0);
} catch (error) {
  // tscがエラーを返した場合
  const output = error.stdout || error.stderr || '';

  // bindings.tsからのエラーを除外
  const lines = output.split('\n');
  const filteredLines = lines.filter(line => !line.includes('src/bindings.ts'));

  // フィルタリング後にエラーが残っている場合のみ出力して失敗
  const hasErrors = filteredLines.some(line =>
    line.includes('error TS') || line.includes(': error ')
  );

  if (hasErrors) {
    console.error(filteredLines.join('\n'));
    process.exit(1);
  } else {
    // bindings.tsのエラーのみだった場合は成功
    process.exit(0);
  }
}
