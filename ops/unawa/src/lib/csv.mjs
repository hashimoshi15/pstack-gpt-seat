// 既存のMac版と同じ縦持ちCSV（対象日,ソース,店舗コード,店舗名,項目,値）をBOM付きで作る。
export const HEADER = ['対象日', 'ソース', '店舗コード', '店舗名', '項目', '値'];

function cell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function toLongCsv({ date, source, storeCode, storeName, items }) {
  const rows = [HEADER.map(cell).join(',')];
  for (const [key, value] of items) {
    rows.push([date, source, storeCode, storeName, key, value].map(cell).join(','));
  }
  return `﻿${rows.join('\n')}\n`;
}

export function csvFileName({ date, source, storeName }) {
  return `${storeName}_${date}_${source.toUpperCase()}_日次.csv`;
}

