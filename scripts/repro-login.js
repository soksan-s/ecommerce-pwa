const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const out = path.join(process.env.TEMP || '.', 'playwright-console.txt');
  try { if (fs.existsSync(out)) fs.unlinkSync(out); } catch (e) {}
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    try { fs.appendFileSync(out, `[${new Date().toISOString()}] ${msg.type()}: ${msg.text()}\n`); } catch (e) {}
  });
  page.on('pageerror', err => {
    try { fs.appendFileSync(out, `[${new Date().toISOString()}] PAGEERROR: ${err.message}\n${err.stack}\n`); } catch (e) {}
  });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' }).catch(() => {});

  for (let i = 0; i < 30; i++) {
    try {
      await page.fill('input[type="email"]', 'soksan@hero.com').catch(() => {});
      await page.fill('input[type="password"]', 'soksan123').catch(() => {});
      await page.click('button[type="submit"]').catch(() => {});
      await page.waitForTimeout(600);

      const logoutByAria = await page.$('button[aria-label="Logout"]');
      if (logoutByAria) {
        await logoutByAria.click().catch(() => {});
      } else {
        const logoutByText = await page.$('text=Logout');
        if (logoutByText) await logoutByText.click().catch(() => {});
      }
      await page.waitForTimeout(600);

      // also capture current URL
      try { fs.appendFileSync(out, `[${new Date().toISOString()}] URL: ${page.url()}\n`); } catch (e) {}
    } catch (e) {
      try { fs.appendFileSync(out, `ERROR: ${e.stack}\n`); } catch (er) {}
    }
  }

  await browser.close();
  console.log('DONE');
  console.log('Output file:', out);
})();