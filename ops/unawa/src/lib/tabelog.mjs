import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// 食べログの店舗ページから、照合に使う項目だけを取り出す。
export function extractTabelog(html) {
  const $ = cheerio.load(html);
  const ld = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      for (const item of [data].flat()) {
        if (item && /Restaurant|FoodEstablishment/.test(item['@type'])) Object.assign(ld, item);
      }
    } catch { /* 壊れたJSON-LDは無視 */ }
  });
  const info = {};
  $('.rstinfo-table tr, table.c-table tr').each((_, tr) => {
    const key = clean($(tr).find('th').first().text());
    const value = clean($(tr).find('td').first().text());
    if (key && value && !(key in info)) info[key] = value;
  });
  const address = typeof ld.address === 'object' ? clean([ld.address.addressRegion, ld.address.addressLocality, ld.address.streetAddress].join('')) : clean(ld.address);
  return {
    name: clean(ld.name) || clean($('.display-name').first().text()) || clean($('h2').first().text()),
    address: address || info['住所'] || '',
    telephone: clean(ld.telephone) || info['予約・お問い合わせ'] || info['お問い合わせ'] || '',
    hours: info['営業時間'] || '',
    closed: info['定休日'] || '',
    prTitle: clean($('.pr-comment-title').first().text()),
    prBody: clean($('.pr-comment__first, .pr-comment__body, .pr-comment-wrap .pr-comment').first().text()),
    serviceCharge: info['サービス料・チャージ'] || info['サービス料・ チャージ'] || '',
  };
}

export function fingerprint(fields) {
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex').slice(0, 16);
}

export function diffFields(baseline, current) {
  const keys = new Set([...Object.keys(baseline || {}), ...Object.keys(current || {})]);
  return [...keys].filter((k) => (baseline?.[k] ?? '') !== (current?.[k] ?? ''));
}
