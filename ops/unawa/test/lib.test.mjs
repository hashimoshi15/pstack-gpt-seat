import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chunk, notify } from '../src/lib/discord.mjs';
import { csvFileName, toLongCsv } from '../src/lib/csv.mjs';
import { jstDate, required, MissingConfigError } from '../src/lib/env.mjs';
import { diffFields, extractTabelog } from '../src/lib/tabelog.mjs';
import { judge } from '../src/lib/urlcheck.mjs';

test('jstDate は日本時間で日付を切り替える', () => {
  assert.equal(jstDate(0, new Date('2026-10-27T14:59:00Z')), '2026-10-27');
  assert.equal(jstDate(0, new Date('2026-10-27T15:00:00Z')), '2026-10-28');
  assert.equal(jstDate(-1, new Date('2026-10-27T15:00:00Z')), '2026-10-27');
});

test('required は未設定を分かる言葉で止める', () => {
  assert.throws(() => required('NOPE', {}), MissingConfigError);
  assert.equal(required('A', { A: 'x' }), 'x');
});

test('CSVは既存のMac版と同じ縦持ち・BOM付き', () => {
  const csv = toLongCsv({ date: '2026-10-26', source: 'aspit', storeCode: '1', storeName: '清水', items: [['実績 売上', '429,240'], ['メモ', 'a"b']] });
  assert.ok(csv.startsWith('﻿"対象日","ソース","店舗コード","店舗名","項目","値"\n'));
  assert.match(csv, /"2026-10-26","aspit","1","清水","実績 売上","429,240"/);
  assert.match(csv, /"a""b"/);
  assert.equal(csvFileName({ date: '2026-10-26', source: 'aspit', storeName: 'うな和 泉' }), 'うな和 泉_2026-10-26_ASPIT_日次.csv');
});

test('Discordの分割は上限を超えない', () => {
  const parts = chunk(Array.from({ length: 300 }, (_, i) => `行${i} ${'あ'.repeat(20)}`).join('\n'));
  assert.ok(parts.length > 1);
  assert.ok(parts.every((p) => p.length <= 1900));
});

test('webhookが無ければ送らずに成功扱い', async () => {
  assert.deepEqual(await notify('test', { webhookUrl: '' }), { sent: false });
});

test('webhookへ送るときはメンションを無効にする', async () => {
  const calls = [];
  const fake = async (url, init) => { calls.push(JSON.parse(init.body.get('payload_json'))); return { ok: true }; };
  await notify('@everyone 日報', { webhookUrl: 'https://example.invalid/hook', fetchImpl: fake });
  assert.deepEqual(calls[0].allowed_mentions, { parse: [] });
});

test('食べログのページから照合項目を取り出す', async () => {
  const html = await readFile(new URL('./fixtures/tabelog.html', import.meta.url), 'utf8');
  const f = extractTabelog(html);
  assert.equal(f.name, '京うな和本店 清水はなれ');
  assert.equal(f.address, '京都府京都市東山区清水1-1');
  assert.equal(f.hours, '11:00 - 21:00');
  assert.equal(f.closed, '不定休');
  assert.equal(f.prTitle, '清水寺すぐの鰻料理');
  assert.equal(f.prBody, '備長炭で焼き上げる一本重。');
  assert.deepEqual(diffFields(f, { ...f, prBody: '別の文' }), ['prBody']);
});

test('公開URLの判定', () => {
  assert.equal(judge(200, '動画です').ok, true);
  assert.equal(judge(404, '').ok, false);
  assert.equal(judge(200, "Sorry, this page isn't available.").ok, false);
  assert.equal(judge(0, '').ok, false);
});

test('Driveは同名があれば作らず、無ければ1回だけ作る', async () => {
  const { uploadOnce, driveConfigured } = await import('../src/lib/drive.mjs');
  assert.equal(driveConfigured({}), false);
  const calls = [];
  const existing = async (url, init = {}) => { calls.push([init.method || 'GET', url]); return { ok: true, json: async () => ({ files: [{ id: 'old' }] }) }; };
  assert.deepEqual(await uploadOnce('t', 'p', "a'b.csv", 'x', 'text/csv', existing), { id: 'old', created: false });
  assert.match(decodeURIComponent(calls[0][1]), /name = 'a\\'b\.csv'/);
  const fresh = async (url, init = {}) => ({ ok: true, json: async () => (init.method === 'POST' ? { id: 'new' } : { files: [] }) });
  assert.deepEqual(await uploadOnce('t', 'p', 'b.csv', 'x', 'text/csv', fresh), { id: 'new', created: true });
});
