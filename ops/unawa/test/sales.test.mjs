import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { matchDate, matchStore, rowsMatching } from '../src/lib/table.mjs';
import { readAspit, readUsen, save, summarize } from '../src/jobs/sales.mjs';
import { withPage } from '../src/lib/browser.mjs';
import { LoginError } from '../src/lib/sites.mjs';
import { startFakeSites } from './fixtures/fake-sites.mjs';

test('多段見出しの表を店舗ごとの（項目,値）にする', () => {
  const html = `<table><tr><th rowspan="2">店舗</th><th colspan="2">売上高管理 実績</th></tr><tr><th>売上</th><th>累計</th></tr>
    <tr><td>1 京うな和本店 清水はなれ</td><td>429,240</td><td>500,000</td></tr></table>`;
  const rows = rowsMatching(html, ['京うな和本店 清水はなれ', 'うな和 泉'], matchStore);
  assert.deepEqual(rows.get('京うな和本店 清水はなれ'), [['売上高管理 実績 売上', '429,240'], ['売上高管理 実績 累計', '500,000']]);
  assert.equal(rows.has('うな和 泉'), false);
});

test('日付の照合は桁違いを取り違えない', () => {
  assert.equal(matchDate('2026-10-01', '2026/10/1'), true);
  assert.equal(matchDate('2026-10-01', '2026/10/12'), false);
  assert.equal(matchDate('2026-10-09', '20261009'), true);
  assert.equal(matchDate('2026-10-09', '2026/10/09(金)'), true);
});

test('取得結果の要約は売上額を含めない', () => {
  const msg = summarize({ source: 'aspit', date: '2026-10-26', results: [
    { store: { name: 'A' }, items: [['実績 売上', '429,240']] },
    { store: { name: 'B' }, items: null },
  ] });
  assert.match(msg, /【要対応】ASPIT 売上取得 2026-10-26：1\/2店/);
  assert.match(msg, /B：表に行がありません/);
  assert.doesNotMatch(msg, /429,240/);
});

const chromium = process.env.UNAWA_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : '');
const browserTest = chromium ? test : test.skip;

browserTest('ASPIT: ログイン→メニュー→日付指定→表の読み取り→CSV', async (t) => {
  process.env.UNAWA_CHROMIUM_PATH = chromium;
  Object.assign(process.env, { ASPIT_LOGIN_ID: 'u', ASPIT_PASSWORD: 'p', ASPIT_COMPANY_CODE: 'C1' });
  const { server, base } = await startFakeSites();
  t.after(() => server.close());
  const site = { loginUrl: `${base}/aspit/login`, reportUrl: `${base}/aspit/report`, menu: ['売上を分析する', '店舗別日次予実表'],
    stores: [{ code: '1', name: '京うな和本店 清水はなれ' }, { code: '6', name: 'うな和 泉' }, { code: '2', name: 'うな和 鶴舞' }] };
  const results = await withPage((page) => readAspit(page, site, '2026-10-26'));
  assert.deepEqual(results[0].items, [['売上高管理 実績 売上', '429,240'], ['売上高管理 実績 累計', '429,240'], ['客数', '75']]);
  assert.equal(results[1].items[2][1], '26');
  assert.equal(results[2].items, null);
  const root = await mkdtemp(join(tmpdir(), 'unawa-'));
  const { name } = await save({ root, source: 'aspit', date: '2026-10-26', store: results[0].store, items: results[0].items });
  assert.equal(name, '京うな和本店 清水はなれ_2026-10-26_ASPIT_日次.csv');
  const csv = await readFile(join(root, 'sales', 'aspit', '2026-10-26', name), 'utf8');
  assert.match(csv, /"2026-10-26","aspit","1","京うな和本店 清水はなれ","売上高管理 実績 売上","429,240"/);
});

browserTest('ASPIT: 認証コードが出たら回避せずに止まる', async (t) => {
  process.env.UNAWA_CHROMIUM_PATH = chromium;
  Object.assign(process.env, { ASPIT_LOGIN_ID: 'u', ASPIT_PASSWORD: 'p', ASPIT_COMPANY_CODE: 'C1' });
  const { server, base } = await startFakeSites({ challenge: true });
  t.after(() => server.close());
  const site = { loginUrl: `${base}/aspit/login`, reportUrl: `${base}/aspit/report`, menu: [], stores: [] };
  await assert.rejects(withPage((page) => readAspit(page, site, '2026-10-26')), LoginError);
});

browserTest('USEN: 店舗を選び、対象日の行だけを読む', async (t) => {
  process.env.UNAWA_CHROMIUM_PATH = chromium;
  Object.assign(process.env, { USEN_LOGIN_ID: 'u', USEN_PASSWORD: 'p' });
  const { server, base } = await startFakeSites();
  t.after(() => server.close());
  const site = { loginUrl: `${base}/usen/login`, reportUrl: `${base}/usen/list`, stores: [{ code: '001', name: '和く' }, { code: '002', name: 'Fruits fondue' }] };
  const results = await withPage((page) => readUsen(page, site, '2026-10-26'));
  assert.deepEqual(results[0].items, [['当年日付', '20261026'], ['当年実績', '34,846'], ['当年客数', '8']]);
  assert.equal(results[1].items[1][1], '103,244');
});
