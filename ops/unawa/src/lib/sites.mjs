// ASPIT・USENの画面操作。セレクタが公開されていないため、画面の文言と入力欄の種類で操作する。
// 2段階認証・画像認証が出たら、回避せずに止めて知らせる。
export class LoginError extends Error {}

const CHALLENGE = /認証コード|ワンタイム|確認コード|二段階|2段階|captcha|私はロボットではありません/i;

function frames(page) {
  return page.frames();
}

export async function firstVisible(page, selector) {
  for (const frame of frames(page)) {
    const loc = frame.locator(selector);
    const n = await loc.count();
    for (let i = 0; i < n; i++) {
      if (await loc.nth(i).isVisible().catch(() => false)) return loc.nth(i);
    }
  }
  return null;
}

export async function isLoginPage(page) {
  return Boolean(await firstVisible(page, 'input[type="password"]'));
}

export async function pageText(page) {
  const texts = [];
  for (const frame of frames(page)) texts.push(await frame.evaluate(() => document.body?.innerText || '').catch(() => ''));
  return texts.join('\n');
}

export async function pageHtml(page) {
  const parts = [];
  for (const frame of frames(page)) parts.push(await frame.content().catch(() => ''));
  return parts.join('\n');
}

export async function login(page, { url, id, password, companyCode }) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const pw = await firstVisible(page, 'input[type="password"]');
  if (!pw) return; // 既にログイン済み
  const scope = (await pw.evaluateHandle((el) => el.form || el.ownerDocument.body)).asElement();
  const texts = await scope.$$('input[type="text"], input[type="email"], input[type="tel"], input:not([type])');
  const visible = [];
  for (const el of texts) if (await el.isVisible()) visible.push(el);
  if (!visible.length) throw new LoginError('ログインIDの入力欄が見つかりません');
  if (companyCode && visible.length >= 2) {
    await visible[0].fill(companyCode);
    await visible[1].fill(id);
  } else {
    await visible[0].fill(id);
  }
  await pw.fill(password);
  const submit = await scope.$('button[type="submit"], input[type="submit"], input[type="image"], button:has-text("ログイン"), a:has-text("ログイン"), input[value*="ログイン"]');
  await Promise.all([
    page.waitForLoadState('domcontentloaded').catch(() => {}),
    submit ? submit.click() : pw.press('Enter'),
  ]);
  await page.waitForTimeout(4000);
  const text = await pageText(page);
  if (CHALLENGE.test(text)) throw new LoginError('2段階認証または画像認証が表示されました。自動では進めません');
  if (await isLoginPage(page)) throw new LoginError('ログインできませんでした（IDかパスワードが違う可能性）');
}

export async function clickText(page, text) {
  const target = await firstVisible(page, `a:has-text("${text}"), button:has-text("${text}"), input[value="${text}"], [onclick]:has-text("${text}"), span:has-text("${text}")`);
  if (!target) return false;
  await target.click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(2500);
  return true;
}

// 日付らしい値の入った入力欄に、対象日を入れる（範囲指定なら開始・終了の両方）。
export async function fillDates(page, date) {
  const slash = date.replaceAll('-', '/');
  let filled = 0;
  for (const frame of frames(page)) {
    const inputs = frame.locator('input[type="text"], input[type="date"], input:not([type])');
    const n = await inputs.count();
    for (let i = 0; i < n; i++) {
      const input = inputs.nth(i);
      if (!(await input.isVisible().catch(() => false))) continue;
      const value = await input.inputValue().catch(() => '');
      const type = await input.getAttribute('type');
      if (type === 'date') {
        await input.fill(date);
        filled++;
      } else if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(value.trim())) {
        await input.fill(value.includes('-') ? date : slash);
        filled++;
      }
    }
  }
  return filled;
}

export async function search(page) {
  for (const label of ['検索', '表示', '集計', '実行']) {
    if (await clickText(page, label)) return true;
  }
  return false;
}

export async function selectStore(page, storeName) {
  for (const frame of frames(page)) {
    const selects = frame.locator('select');
    const n = await selects.count();
    for (let i = 0; i < n; i++) {
      const select = selects.nth(i);
      const options = await select.locator('option').allTextContents();
      const option = options.find((o) => o.includes(storeName));
      if (option) {
        await select.selectOption({ label: option });
        return true;
      }
    }
  }
  return clickText(page, storeName);
}
