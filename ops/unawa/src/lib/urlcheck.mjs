// 公開済みの投稿が消えたり非公開になったりしていないかを、ページの文言で判定する。
const GONE = [
  'このページはご利用いただけません',
  "Sorry, this page isn't available",
  'この動画は現在ご利用いただけません',
  'Video currently unavailable',
  "Couldn't find this account",
  'This post is unavailable',
  'ページが見つかりません',
];

export function judge(status, text) {
  if (!status) return { ok: false, reason: '応答なし' };
  if (status === 404 || status === 410) return { ok: false, reason: `HTTP ${status}（削除の可能性）` };
  if (status >= 400) return { ok: false, reason: `HTTP ${status}` };
  const hit = GONE.find((phrase) => text.includes(phrase));
  if (hit) return { ok: false, reason: `「${hit}」と表示` };
  return { ok: true, reason: `HTTP ${status}` };
}
