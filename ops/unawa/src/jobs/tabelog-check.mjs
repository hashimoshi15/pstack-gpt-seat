// 食べログの掲載内容を毎日取得し、承認済みの基準と比べる。違いがあればDiscordへ知らせる。
// 基準は data ブランチの baseline/tabelog/<店舗ID>.json。UNAWA_APPROVE_BASELINE=true で今回の取得内容を基準にする。
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dataDir, jstDate } from '../lib/env.mjs';
import { notify } from '../lib/discord.mjs';
import { withPage } from '../lib/browser.mjs';
import { diffFields, extractTabelog, fingerprint } from '../lib/tabelog.mjs';

const LABELS = { name: '店名', address: '住所', telephone: '電話', hours: '営業時間', closed: '定休日', prTitle: 'PRの見出し', prBody: 'PR本文', serviceCharge: 'サービス料・チャージ' };

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

export async function run({ stores, fetchHtml, root = dataDir(), date = jstDate(), approve = process.env.UNAWA_APPROVE_BASELINE === 'true' }) {
  const lines = [];
  let problems = 0;
  for (const store of stores) {
    let fields;
    try {
      fields = extractTabelog(await fetchHtml(store.url));
    } catch (error) {
      problems++;
      lines.push(`・${store.name}: 取得できませんでした（${error.message}）`);
      continue;
    }
    if (!fields.name) {
      problems++;
      lines.push(`・${store.name}: ページは開けましたが店名が読み取れません（画面の変更かアクセス制限の可能性）`);
      continue;
    }
    const snapshotDir = join(root, 'tabelog', date);
    await mkdir(snapshotDir, { recursive: true });
    await writeFile(join(snapshotDir, `${store.id}.json`), `${JSON.stringify({ ...store, fields, fingerprint: fingerprint(fields) }, null, 2)}\n`);
    const baselinePath = join(root, 'baseline', 'tabelog', `${store.id}.json`);
    const baseline = await readJson(baselinePath);
    if (approve || !baseline) {
      await mkdir(join(root, 'baseline', 'tabelog'), { recursive: true });
      await writeFile(baselinePath, `${JSON.stringify({ approvedAt: date, fields }, null, 2)}\n`);
      lines.push(`・${store.name}: ${approve ? '今回の内容を基準にしました' : '基準が無かったため今回の内容を基準にしました'}`);
      continue;
    }
    const changed = diffFields(baseline.fields, fields);
    if (changed.length) {
      problems++;
      lines.push(`・${store.name}: 基準（${baseline.approvedAt}）と違います → ${changed.map((k) => LABELS[k] || k).join('・')}`);
    } else {
      lines.push(`・${store.name}: 一致`);
    }
  }
  const head = problems ? `【要確認】食べログ照合 ${date}` : `食べログ照合 ${date}：すべて一致`;
  return { problems, message: [head, ...lines].join('\n') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stores = JSON.parse(await readFile(new URL('../../config/tabelog-stores.json', import.meta.url), 'utf8'));
  const result = await withPage((page) => run({
    stores,
    fetchHtml: async (url) => {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded' });
      if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : '応答なし'}`);
      return page.content();
    },
  }));
  await notify(result.message);
  console.log(result.message);
}
