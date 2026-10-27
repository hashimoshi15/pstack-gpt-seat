// Google Driveへの保存（任意）。個人のGoogleアカウントのDriveはサービスアカウントでは書き込めないため、
// OAuthのリフレッシュトークンを使う。3つのSecretsが揃っていなければ何もしない。
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name';

export function driveConfigured(env = process.env) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN);
}

export async function accessToken(env = process.env, fetchImpl = fetch) {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Googleの認証に失敗しました（HTTP ${res.status}）`);
  return (await res.json()).access_token;
}

function q(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export async function findChild(token, parentId, name, fetchImpl = fetch) {
  const query = `${q(parentId)} in parents and name = ${q(name)} and trashed = false`;
  const res = await fetchImpl(`${API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Driveの検索に失敗しました（HTTP ${res.status}）`);
  return (await res.json()).files[0] || null;
}

export async function ensureFolder(token, parentId, name, fetchImpl = fetch) {
  const existing = await findChild(token, parentId, name, fetchImpl);
  if (existing) return existing.id;
  const res = await fetchImpl(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name, parents: [parentId], mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!res.ok) throw new Error(`Driveのフォルダ作成に失敗しました（HTTP ${res.status}）`);
  return (await res.json()).id;
}

// 同名のファイルが既にあれば上書きせずに既存のIDを返す（再実行しても重複しない）。
export async function uploadOnce(token, parentId, name, body, mimeType = 'text/csv', fetchImpl = fetch) {
  const existing = await findChild(token, parentId, name, fetchImpl);
  if (existing) return { id: existing.id, created: false };
  const boundary = `unawa${Date.now()}`;
  const payload = [
    `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify({ name, parents: [parentId] }),
    `\r\n--${boundary}\r\ncontent-type: ${mimeType}\r\n\r\n`,
    body,
    `\r\n--${boundary}--`,
  ].join('');
  const res = await fetchImpl(UPLOAD, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${boundary}` },
    body: payload,
  });
  if (!res.ok) throw new Error(`Driveへの保存に失敗しました（HTTP ${res.status}）`);
  return { id: (await res.json()).id, created: true };
}
