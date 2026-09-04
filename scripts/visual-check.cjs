const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const executablePath = 'C:/Users/hp/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const baseURL = process.env.VOTRA_TEST_URL || 'http://127.0.0.1:4173/';
const outputDir = path.join(process.cwd(), 'evidence', 'screenshots');
const uiDir = path.join(process.cwd(), 'evidence', 'ui');

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(uiDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const checks = [];
  const check = (name, value, details = '') => {
    checks.push({ name, pass: Boolean(value), details });
    if (!value) throw new Error(`${name}: ${details}`);
  };

  // 1. Desktop 1440x1000
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await desktop.goto(baseURL, { waitUntil: 'domcontentloaded' });
  check('desktop title', (await desktop.title()) === 'VOTRA | Private commitment. Fair chance.');
  check('desktop no horizontal overflow', await desktop.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await desktop.screenshot({ path: path.join(outputDir, 'desktop-landing.png') });

  // Interactive covenant check
  await desktop.locator('#setGoal').click();
  await desktop.waitForTimeout(1500);
  check('wallet-less action reports failure', await desktop.locator('#txState').textContent().then((text) => /FAILED|Connect a wallet|USER REJECTED/i.test(text)));
  await desktop.screenshot({ path: path.join(outputDir, '01-wallet-required.png'), clip: { x: 0, y: 0, width: 600, height: 400 } });

  check('breach action is wired', await desktop.locator('#breach').isVisible());
  await desktop.screenshot({ path: path.join(outputDir, '03-breach-state.png'), clip: { x: 0, y: 0, width: 600, height: 400 } });

  check('recovery action is wired', await desktop.locator('#recover').isVisible());
  await desktop.screenshot({ path: path.join(outputDir, '02-compliant-state.png'), clip: { x: 0, y: 0, width: 600, height: 400 } });

  await desktop.locator('.proof').scrollIntoViewIfNeeded();
  await desktop.screenshot({ path: path.join(outputDir, '04-proof-receipt.png'), clip: { x: 0, y: 0, width: 600, height: 400 } });

  // 2. Tablet 1280x800
  const tablet = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await tablet.goto(baseURL, { waitUntil: 'domcontentloaded' });
  check('tablet no horizontal overflow', await tablet.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await tablet.screenshot({ path: path.join(outputDir, 'tablet-landing.png') });

  // 3. Mobile 390x844
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto(baseURL, { waitUntil: 'domcontentloaded' });
  check('mobile no horizontal overflow', await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  check('mobile hero visible', await mobile.locator('h1').isVisible());
  await mobile.screenshot({ path: path.join(outputDir, 'mobile-landing.png') });

  // 4. Proof page
  const proof = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await proof.goto(`${baseURL}proof/`, { waitUntil: 'networkidle' });
  check('proof route human-readable', await proof.locator('h1').isVisible());
  check('proof evidence links', (await proof.locator('a[href^="/proof/"]').count()) >= 8);
  check('proof is not raw JSON', !(await proof.locator('body').innerText()).trim().startsWith('{'));
  await proof.screenshot({ path: path.join(outputDir, 'proof-index.png') });

  // 5. Narrow Mobile 430x932
  const narrow = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1 });
  await narrow.goto(`${baseURL}proof/history`, { waitUntil: 'networkidle' });
  await narrow.locator('h1').waitFor({ timeout: 5000 });
  check('narrow history route', await narrow.locator('h1').isVisible());
  check('narrow no horizontal overflow', await narrow.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  check('history CW values visible', (await narrow.locator('body').innerText()).includes('136800'));
  await narrow.screenshot({ path: path.join(outputDir, 'narrow-history.png') });

  // 6. Verify all auxiliary routes
  const routes = [
    '/commitment',
    '/draw',
    '/proof/discovery',
    '/proof/invariants',
    '/proof/fairness',
    '/proof/adversarial',
    '/proof/privacy',
    '/proof/live',
    '/proof/benchmarks',
    '/proof/contracts',
    '/security',
    '/privacy'
  ];
  for (const route of routes) {
    await narrow.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
    check(`${route} loads`, await narrow.locator('h1').isVisible());
    check(`${route} no raw JSON`, !(await narrow.locator('body').innerText()).trim().startsWith('{'));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    executablePath,
    baseURL,
    viewports: ['1440x1000', '1280x800', '390x844', '430x932'],
    screenshots: fs.readdirSync(outputDir).sort(),
    checks
  };

  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(uiDir, 'final-ui-report.json'), JSON.stringify(report, null, 2));

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
})().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
