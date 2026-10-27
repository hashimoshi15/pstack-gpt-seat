export class MissingConfigError extends Error {}

export function required(name, env = process.env) {
  const value = env[name];
  if (!value) throw new MissingConfigError(`${name} が未設定です（GitHubのSecretsに登録してください）`);
  return value;
}

export function optional(name, fallback = '', env = process.env) {
  return env[name] || fallback;
}

// 日本時間の日付（YYYY-MM-DD）。offsetDays=-1 で前日。
export function jstDate(offsetDays = 0, now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 3600e3 + offsetDays * 86400e3);
  return jst.toISOString().slice(0, 10);
}

export function dataDir(env = process.env) {
  return env.UNAWA_DATA_DIR || 'out';
}
