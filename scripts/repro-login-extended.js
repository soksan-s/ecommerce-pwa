const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const out = path.join(process.env.TEMP || '.', 'playwright-extended.txt');
  const shotsDir = path.join(process.env.TEMP || '.', 'playwright-shots');
  try { if (fs.existsSync(out)) fs.unlinkSync(out); } catch (e) {}
  try { if (!fs.existsSync(shotsDir)) fs.mkdirSync(shotsDir); } catch(e){}

  function log(...args) { try { fs.appendFileSync(out, `[${new Date().toISOString()}] ${args.join(' ')}\n`); } catch (e) {} }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLines = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLines.push(text);
    if (consoleLines.length > 200) consoleLines.shift();
    log('CONSOLE:', text);
  });
  page.on('pageerror', err => {
    log('PAGEERROR:', err.message);
    log(err.stack || 'no stack');
  });

  page.on('response', async (response) => {
    try {
      const url = response.url();
      if (url.includes('/api/auth/login') || url.includes('/api/auth/logout')) {
        const status = response.status();
        let text = '';
        try { text = await response.text(); } catch (e) { text = `<<unable to read body: ${e.message}>>`; }
        log('NETWORK', response.status(), url, text.replace(/\s+/g,' ').slice(0,1000));
      }
    } catch (e) { log('RESPONSE_HANDLER_ERROR', e.message); }
  });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' }).catch(() => {});

  for (let i = 0; i < 30; i++) {
    log('ITERATION_START', i);
    try {
      await page.fill('input[type="email"]', 'soksan@hero.com').catch(()=>{});
      await page.fill('input[type="password"]', 'soksan123').catch(()=>{});
      await page.click('button[type="submit"]').catch(()=>{});

      // wait for either navigation or a short delay
      try {
        await Promise.race([page.waitForNavigation({ timeout: 2000 }).catch(()=>{}), new Promise(r=>setTimeout(r,1500))]);
      } catch(e){}

      // capture screenshot
      const shotPath = path.join(shotsDir, `shot-${i}.png`);
      await page.screenshot({ path: shotPath, fullPage: true }).catch(()=>{});
      log('SHOT', shotPath);

      // check for white/blank body
      const bodyInner = await page.evaluate(() => document.body && document.body.innerHTML ? document.body.innerHTML.length : 0).catch(()=>0);
      log('BODY_LENGTH', bodyInner);
      if (bodyInner < 20) {
        log('POSSIBLE_BLANK_PAGE', 'body length low', bodyInner);
        const dumpPath = path.join(shotsDir, `dump-${i}.html`);
        const html = await page.content().catch(()=>'<no-html>');
        try { fs.writeFileSync(dumpPath, html); } catch(e){}
        log('DUMP', dumpPath);
      }

      // attempt logout
      try {
        const logoutByAria = await page.$('button[aria-label="Logout"]');
        if (logoutByAria) {
          await logoutByAria.click().catch(()=>{});
        } else {
          const logoutByText = await page.$('text=Logout');
          if (logoutByText) await logoutByText.click().catch(()=>{});
        }
      } catch(e) { log('LOGOUT_ERROR', e.message); }

      // capture URL
      log('URL', page.url());

    } catch (e) {
      log('ITERATION_ERROR', e.stack || e.message);
    }
    await page.waitForTimeout(500);
  }

  log('DONE');
  await browser.close();
  console.log('DONE', out, shotsDir);
})();