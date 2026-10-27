// Playwrightの起動をまとめる。Actionsでは `npx playwright install --with-deps chromium` 済みの前提。
export async function withPage(fn, { headless = true } = {}) {
  const { chromium } = await import('playwright');
  const executablePath = process.env.UNAWA_CHROMIUM_PATH || undefined;
  const browser = await chromium.launch({ headless, executablePath });
  try {
    const context = await browser.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
    const page = await context.newPage();
    page.setDefaultTimeout(45_000);
    return await fn(page, context);
  } finally {
    await browser.close();
  }
}
