import * as cheerio from 'cheerio';

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// colspan/rowspan を展開して、表を2次元の文字列配列にする。
export function tableToGrid($, table, headerFlags = []) {
  const grid = [];
  $(table).find('tr').each((r, tr) => {
    headerFlags[r] = $(tr).children('th').length > 0 && $(tr).children('td').length === 0;
    grid[r] = grid[r] || [];
    let c = 0;
    $(tr).children('th,td').each((_, cell) => {
      while (grid[r][c] !== undefined) c++;
      const text = clean($(cell).text());
      const colspan = Number($(cell).attr('colspan')) || 1;
      const rowspan = Number($(cell).attr('rowspan')) || 1;
      for (let dr = 0; dr < rowspan; dr++) {
        grid[r + dr] = grid[r + dr] || [];
        for (let dc = 0; dc < colspan; dc++) grid[r + dr][c + dc] = text;
      }
      c += colspan;
    });
  });
  return grid.map((row) => Array.from(row, (v) => v ?? ''));
}

// keys の各キーについて、match(セル) に当たるセルを含む行を探し、その上の見出し行（当たらない行）を
// 重ねて項目名にする。例：「売上高管理 / 実績 / 売上」→「売上高管理 実績 売上」。
// dropMatched=true なら、当たったセル（店舗名など）自身は項目から外す。
export function rowsMatching(html, keys, match, { dropMatched = true } = {}) {
  const $ = cheerio.load(html);
  const found = new Map();
  $('table').each((_, table) => {
    if ($(table).find('table').length) return; // 入れ子の外枠は飛ばす
    const isHeader = [];
    const grid = tableToGrid($, table, isHeader);
    const dataRows = grid
      .map((row, i) => ({ i, row, key: keys.find((key) => row.some((v) => match(key, v))) }))
      .filter((r) => r.key !== undefined);
    if (!dataRows.length) return;
    // 見出しは th だけの行。th を使わない表では、最初の該当行より上の行をすべて見出しとみなす。
    const above = grid.slice(0, dataRows[0].i).map((row, i) => ({ row, header: isHeader[i] }));
    const thRows = above.filter((r) => r.header);
    const headerRows = (thRows.length ? thRows : above).map((r) => r.row).filter((row) => row.some(Boolean));
    const width = Math.max(...grid.map((row) => row.length));
    const headers = Array.from({ length: width }, (_, c) => {
      const parts = [];
      for (const row of headerRows) {
        const v = row[c] || '';
        if (v && parts.at(-1) !== v) parts.push(v);
      }
      return parts.join(' ');
    });
    for (const { row, key } of dataRows) {
      if (found.has(key)) continue;
      const pairs = [];
      headers.forEach((h, c) => {
        const value = row[c] ?? '';
        if (h && !(dropMatched && match(key, value))) pairs.push([h, value]);
      });
      found.set(key, pairs);
    }
  });
  return found;
}

export const matchStore = (name, value) => value === name || value.endsWith(` ${name}`) || value.endsWith(name);

export function matchDate(date, value) {
  const [y, m, d] = date.split('-').map(Number);
  const v = value.replace(/\s/g, '');
  const hit = v.match(/^(\d{4})[-/年]?(\d{1,2})[-/月]?(\d{1,2})日?(?:\(.\))?$/);
  return Boolean(hit) && Number(hit[1]) === y && Number(hit[2]) === m && Number(hit[3]) === d;
}
