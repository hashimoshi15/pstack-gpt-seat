import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run as tabelog } from '../src/jobs/tabelog-check.mjs';
import { run as urls } from '../src/jobs/public-url-check.mjs';
import { run as health } from '../src/jobs/health.mjs';

const fixture = await readFile(new URL('./fixtures/tabelog.html', import.meta.url), 'utf8');
const stores = [{ id: '1', name: '清水', url: 'https://tabelog.invalid/1' }];

test('食べログ: 基準が無ければ作り、次回は一致、変われば要確認', async () => {
  const root = await mkdtemp(join(tmpdir(), 'unawa-'));
  const first = await tabelog({ stores, fetchHtml: async () => fixture, root, date: '2026-10-27', approve: false });
  assert.equal(first.problems, 0);
  assert.match(first.message, /基準が無かった/);
  const same = await tabelog({ stores, fetchHtml: async () => fixture, root, date: '2026-10-28', approve: false });
  assert.match(same.message, /一致/);
  const changed = await tabelog({ stores, fetchHtml: async () => fixture.replace('一本重', '鰻重'), root, date: '2026-10-29', approve: false });
  assert.equal(changed.problems, 1);
  assert.match(changed.message, /【要確認】/);
  assert.match(changed.message, /PR本文/);
  const approved = await tabelog({ stores, fetchHtml: async () => fixture.replace('一本重', '鰻重'), root, date: '2026-10-29', approve: true });
  assert.equal(approved.problems, 0);
});

test('食べログ: 取得失敗や読み取り不能は要確認', async () => {
  const root = await mkdtemp(join(tmpdir(), 'unawa-'));
  const failed = await tabelog({ stores, fetchHtml: async () => { throw new Error('HTTP 403'); }, root });
  assert.equal(failed.problems, 1);
  const empty = await tabelog({ stores, fetchHtml: async () => '<html></html>', root });
  assert.match(empty.message, /読み取れません/);
});

test('公開URL: NGを数える', async () => {
  const result = await urls({
    targets: [{ label: 'a', url: 'https://x.invalid/a' }, { label: 'b', url: 'https://x.invalid/b' }],
    open: async (url) => (url.endsWith('a') ? { status: 200, text: 'ok' } : { status: 404, text: '' }),
    date: '2026-10-27',
  });
  assert.equal(result.problems, 1);
  assert.match(result.message, /NG b/);
});

test('見張り: 止まっている保存を知らせる', async () => {
  const root = await mkdtemp(join(tmpdir(), 'unawa-'));
  await mkdir(join(root, 'sales', 'aspit', '2026-10-26'), { recursive: true });
  await mkdir(join(root, 'sales', 'usen', '2026-10-22'), { recursive: true });
  await mkdir(join(root, 'tabelog', '2026-10-27'), { recursive: true });
  await writeFile(join(root, 'sales', 'aspit', 'notes.txt'), '');
  const result = await health({ root, today: '2026-10-27' });
  assert.equal(result.problems, 1);
  assert.match(result.message, /USEN）: 最新 2026-10-22（5日止まっています）/);
  assert.match(result.message, /ASPIT）: 最新 2026-10-26\n/);
});
