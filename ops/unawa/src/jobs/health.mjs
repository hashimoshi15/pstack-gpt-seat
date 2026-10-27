// 保存済みデータの鮮度を見て、止まっている仕事を知らせる（Macが止まっていても動く見張り）。
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { dataDir, jstDate } from '../lib/env.mjs';
import { notify } from '../lib/discord.mjs';

async function latestDate(dir) {
  try {
    const names = (await readdir(dir)).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
    return names.at(-1) || null;
  } catch {
    return null;
  }
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400e3);
}

export async function run({ root = dataDir(), today = jstDate() } = {}) {
  const checks = [
    { label: '売上（ASPIT）', dir: join(root, 'sales', 'aspit'), maxAge: 1 },
    { label: '売上（USEN）', dir: join(root, 'sales', 'usen'), maxAge: 1 },
    { label: '食べログ照合', dir: join(root, 'tabelog'), maxAge: 1 },
  ];
  const lines = [];
  let problems = 0;
  for (const check of checks) {
    const last = await latestDate(check.dir);
    if (!last) {
      problems++;
      lines.push(`・${check.label}: まだ一度も保存されていません`);
      continue;
    }
    const age = daysBetween(last, today);
    const late = age > check.maxAge;
    if (late) problems++;
    lines.push(`・${check.label}: 最新 ${last}${late ? `（${age}日止まっています）` : ''}`);
  }
  const head = problems ? `【要対応】運用の見張り ${today}` : `運用の見張り ${today}：すべて最新`;
  return { problems, message: [head, ...lines].join('\n') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await run();
  await notify(result.message);
  console.log(result.message);
}
