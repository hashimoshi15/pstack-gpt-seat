// ASPIT・USENに似せた最小の画面。ログイン、メニュー、日付指定、多段見出しの表を再現する。
import { createServer } from 'node:http';

const page = (body) => `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
const loginForm = (action, extra = '') => page(`<form method="post" action="${action}">${extra}<input type="text" name="id"><input type="password" name="pw"><input type="submit" value="ログイン"></form>`);

export function startFakeSites({ challenge = false } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const authed = (req.headers.cookie || '').includes('s=1');
    const send = (html, headers = {}) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', ...headers }); res.end(html); };
    let body = '';
    for await (const chunk of req) body += chunk;
    const form = new URLSearchParams(body);

    if (url.pathname === '/aspit/login') {
      if (req.method === 'POST') {
        if (challenge) return send(page('<p>認証コードを入力してください</p>'));
        if (form.get('company') === 'C1' && form.get('id') === 'u' && form.get('pw') === 'p') {
          res.writeHead(302, { location: '/aspit/home', 'set-cookie': 's=1; path=/' });
          return res.end();
        }
      }
      return send(loginForm('/aspit/login', '<input type="text" name="company">'));
    }
    if (!authed && url.pathname.startsWith('/aspit')) { res.writeHead(302, { location: '/aspit/login' }); return res.end(); }
    if (url.pathname === '/aspit/home') return send(page('<a href="/aspit/menu">売上を分析する</a>'));
    if (url.pathname === '/aspit/menu') return send(page('<a href="/aspit/report">店舗別日次予実表</a>'));
    if (url.pathname === '/aspit/report') {
      const from = url.searchParams.get('from');
      const table = from === '2026/10/26' ? `<table>
        <tr><th rowspan="2">店舗</th><th colspan="2">売上高管理 実績</th><th rowspan="2">客数</th></tr>
        <tr><th>売上</th><th>累計</th></tr>
        <tr><td>1 京うな和本店 清水はなれ</td><td>429,240</td><td>429,240</td><td>75</td></tr>
        <tr><td>6 うな和 泉</td><td>166,780</td><td>166,780</td><td>26</td></tr>
      </table>` : '';
      return send(page(`<form method="get"><input type="text" name="from" value="2026/10/27"><input type="text" name="to" value="2026/10/27"><input type="submit" value="検索"></form>${table}`));
    }

    if (url.pathname === '/usen/login') {
      if (req.method === 'POST' && form.get('id') === 'u' && form.get('pw') === 'p') {
        res.writeHead(302, { location: '/usen/list', 'set-cookie': 's=1; path=/' });
        return res.end();
      }
      return send(loginForm('/usen/login'));
    }
    if (url.pathname === '/usen/list') {
      if (!authed) { res.writeHead(302, { location: '/usen/login' }); return res.end(); }
      const store = url.searchParams.get('store');
      const date = url.searchParams.get('date');
      const amount = store === '001' ? '34,846' : '103,244';
      const table = date === '2026-10-26' ? `<table><tr><th></th><th>当年日付</th><th>当年実績</th><th>当年客数</th></tr>
        <tr><td></td><td>TOTAL</td><td>${amount}</td><td>8</td></tr>
        <tr><td>0</td><td>20261026</td><td>${amount}</td><td>8</td></tr></table>` : '';
      return send(page(`<form method="get"><select name="store"><option value="001">001 和く</option><option value="002">002 Fruits fondue</option></select><input type="date" name="date" value="2026-10-27"><button type="submit">検索</button></form>${table}`));
    }
    res.writeHead(404); res.end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}
