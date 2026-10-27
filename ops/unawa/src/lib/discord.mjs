import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const LIMIT = 1900;

export function chunk(text, limit = LIMIT) {
  const parts = [];
  let current = '';
  for (const line of text.split('\n')) {
    if (current && current.length + line.length + 1 > limit) {
      parts.push(current);
      current = '';
    }
    current = current ? `${current}\n${line}` : line.slice(0, limit);
  }
  if (current) parts.push(current);
  return parts;
}

// webhook URLが無ければ標準出力に出すだけにする（Secrets登録前でもジョブは落とさない）。
export async function notify(content, { files = [], webhookUrl = process.env.DISCORD_WEBHOOK_URL, fetchImpl = fetch } = {}) {
  if (!webhookUrl) {
    console.log(`[discord:未送信] ${content}`);
    return { sent: false };
  }
  const parts = chunk(content);
  for (let i = 0; i < parts.length; i++) {
    const last = i === parts.length - 1;
    const form = new FormData();
    form.append('payload_json', JSON.stringify({ content: parts[i], allowed_mentions: { parse: [] } }));
    if (last) {
      for (const [n, path] of files.entries()) {
        form.append(`files[${n}]`, new Blob([await readFile(path)]), basename(path));
      }
    }
    const res = await fetchImpl(webhookUrl, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Discordへの送信に失敗しました（HTTP ${res.status}）`);
  }
  return { sent: true, messages: parts.length };
}
