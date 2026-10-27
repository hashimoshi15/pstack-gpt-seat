// config/watch-urls.json の公開URLを開き、表示できるかを確かめる。
import { readFile } from 'node:fs/promises';
import { jstDate } from '../lib/env.mjs';
import { notify } from '../lib/discord.mjs';
import { withPage } from '../lib/browser.mjs';
import { judge } from '../lib/urlcheck.mjs';

export async function run({ targets, open, date = jstDate() }) {
  const lines = [];
  let problems = 0;
  for (const target of targets) {
    let verdict;
    try {
      const { status, text } = await open(target.url);
      verdict = judge(status, text);
    } catch (error) {
      verdict = { ok: false, reason: error.message };
    }
    if (!verdict.ok) problems++;
    lines.push(`・${verdict.ok ? 'OK' : 'NG'} ${target.label}: ${verdict.reason}`);
  }
  const head = problems ? `【要確認】公開URL確認 ${date}（NG ${problems}件）` : `公開URL確認 ${date}：${targets.length}件すべて表示OK`;
  return { problems, message: [head, ...lines].join('\n') };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const targets = JSON.parse(await readFile(new URL('../../config/watch-urls.json', import.meta.url), 'utf8'));
  const result = await withPage((page) => run({
    targets,
    open: async (url) => {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      return { status: res ? res.status() : 0, text: await page.evaluate(() => document.body.innerText) };
    },
  }));
  await notify(result.message);
  console.log(result.message);
}
