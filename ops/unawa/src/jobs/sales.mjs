// ASPIT・USENの前日分の売上を画面から読み取り、Mac版と同じCSVで保存する。
//   node src/jobs/sales.mjs aspit|usen
// 保存先: <data>/sales/<source>/<対象日>/<店舗名>_<対象日>_<SOURCE>_日次.csv
// Driveの設定（GOOGLE_* と UNAWA_DRIVE_SALES_FOLDER_ID）があれば、Mac版と同じ
// 「<SOURCE>/<店舗名>/<YYYY>年/<MM>月/」へも保存する。売上額はDiscordへ送らない。
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dataDir, jstDate, optional, required, MissingConfigError } from '../lib/env.mjs';
import { notify } from '../lib/discord.mjs';
import { withPage } from '../lib/browser.mjs';
import { csvFileName, toLongCsv } from '../lib/csv.mjs';
import { matchDate, matchStore, rowsMatching } from '../lib/table.mjs';
import { clickText, fillDates, isLoginPage, login, pageHtml, search, selectStore } from '../lib/sites.mjs';
import { accessToken, driveConfigured, ensureFolder, uploadOnce } from '../lib/drive.mjs';

const LABEL = { aspit: 'ASPIT', usen: 'USEN' };

export async function save({ root, source, date, store, items }) {
  const dir = join(root, 'sales', source, date);
  await mkdir(dir, { recursive: true });
  const name = csvFileName({ date, source, storeName: store.name });
  const body = toLongCsv({ date, source, storeCode: store.code, storeName: store.name, items });
  await writeFile(join(dir, name), body);
  return { name, body };
}

export async function toDrive({ source, date, store, name, body, env = process.env }) {
  if (!driveConfigured(env) || !env.UNAWA_DRIVE_SALES_FOLDER_ID) return null;
  const token = await accessToken(env);
  const [y, m] = date.split('-');
  let parent = env.UNAWA_DRIVE_SALES_FOLDER_ID;
  for (const folder of [LABEL[source], store.name, `${y}年`, `${m}月`]) parent = await ensureFolder(token, parent, folder);
  return uploadOnce(token, parent, name, body);
}

export async function readAspit(page, site, date) {
  await login(page, {
    url: site.loginUrl,
    id: required('ASPIT_LOGIN_ID'),
    password: required('ASPIT_PASSWORD'),
    companyCode: optional('ASPIT_COMPANY_CODE'),
  });
  // 新しいタブで直接開くとセッションが切れる記録があるため、同じタブでメニューから辿り、だめならURLを使う。
  let reached = true;
  for (const label of site.menu) reached = reached && (await clickText(page, label));
  if (!reached) await page.goto(site.reportUrl, { waitUntil: 'domcontentloaded' });
  if (await isLoginPage(page)) throw new Error('予実表を開く途中でログイン画面に戻りました');
  if (!(await fillDates(page, date))) throw new Error('日付の入力欄が見つかりません');
  await search(page);
  await page.waitForTimeout(4000);
  const rows = rowsMatching(await pageHtml(page), site.stores.map((s) => s.name), matchStore);
  return site.stores.map((store) => ({ store, items: rows.get(store.name) || null }));
}

export async function readUsen(page, site, date) {
  await login(page, { url: site.loginUrl, id: required('USEN_LOGIN_ID'), password: required('USEN_PASSWORD') });
  const results = [];
  for (const store of site.stores) {
    await page.goto(site.reportUrl, { waitUntil: 'domcontentloaded' });
    if (await isLoginPage(page)) throw new Error('売上実績を開く途中でログイン画面に戻りました');
    if (!(await selectStore(page, store.name))) {
      results.push({ store, items: null, reason: '店舗を選べません' });
      continue;
    }
    if (!(await fillDates(page, date))) throw new Error('日付の入力欄が見つかりません');
    await search(page);
    await page.waitForTimeout(4000);
    const rows = rowsMatching(await pageHtml(page), [date], matchDate, { dropMatched: false });
    results.push({ store, items: rows.get(date) || null });
  }
  return results;
}

export function summarize({ source, date, results, error }) {
  const ok = results.filter((r) => r.items?.length);
  const ng = results.filter((r) => !r.items?.length);
  const head = error || ng.length
    ? `【要対応】${LABEL[source]} 売上取得 ${date}：${ok.length}/${results.length || '?'}店`
    : `${LABEL[source]} 売上取得 ${date}：${ok.length}店すべて保存`;
  const lines = [head];
  if (error) lines.push(`・止まった理由：${error}`);
  for (const r of results) {
    if (!r.items?.length) lines.push(`・${r.store.name}：${r.reason || '表に行がありません'}`);
    else if (r.reason) lines.push(`・${r.store.name}：${r.reason}`);
  }
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const source = process.argv[2];
  if (!LABEL[source]) throw new Error('aspit か usen を指定してください');
  const site = JSON.parse(await readFile(new URL('../../config/sales.json', import.meta.url), 'utf8'))[source];
  const date = optional('UNAWA_SALES_DATE') || jstDate(-1);
  const root = dataDir();
  let results = [];
  let error = '';
  try {
    results = await withPage(async (page) => {
      try {
        return await (source === 'aspit' ? readAspit : readUsen)(page, site, date);
      } catch (e) {
        await page.screenshot({ path: join(process.cwd(), `debug-${source}.png`), fullPage: true }).catch(() => {});
        throw e;
      }
    });
    for (const r of results.filter((x) => x.items?.length)) {
      const saved = await save({ root, source, date, store: r.store, items: r.items });
      await toDrive({ source, date, store: r.store, ...saved }).catch((e) => { r.reason = `Driveへの保存に失敗（${e.message}）`; });
    }
  } catch (e) {
    error = e instanceof MissingConfigError ? e.message : e.message.split('\n')[0];
  }
  const message = summarize({ source, date, results, error });
  await notify(message);
  console.log(message);
  if (error || results.some((r) => !r.items?.length)) process.exitCode = 1;
}
