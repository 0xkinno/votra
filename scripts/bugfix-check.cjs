const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const executablePath = 'C:/Users/hp/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const baseURL = process.env.VOTRA_TEST_URL || 'http://127.0.0.1:4173/';
const outputDir = path.join(process.cwd(), 'evidence', 'screenshots', 'qa');
fs.mkdirSync(outputDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log('PASS:', message);
}

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => failedRequests.push(req.url() + ' :: ' + (req.failure() ? req.failure().errorText : 'unknown')));
  page.on('response', (res) => {
    if (res.status() >= 400) failedRequests.push(res.status() + ' ' + res.url());
  });

  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('h1').first().waitFor({ timeout: 15000 });
  assert((await page.title()) === 'VOTRA | Private commitment. Fair chance.', 'landing page title renders');
  const homeBodyText = (await page.locator('body').innerText()) || '';
  assert(homeBodyText.includes('ILLUSTRATIVE'), 'landing balance panels are explicitly labelled illustrative while disconnected');
  assert(homeBodyText.includes('TESTNET DEMO DEPOSIT'), 'landing exposes the wallet-signed testnet demo deposit action');
  assert((await page.evaluate(() => typeof window.relayerSDK)) === 'object', 'window.relayerSDK global is loaded from the vendored UMD');
  assert((await page.evaluate(() => typeof window.relayerSDK.initSDK)) === 'function', 'window.relayerSDK.initSDK exists');

  const sdkInit = await page.evaluate(async () => {
    try {
      const ok = await window.relayerSDK.initSDK();
      return { ok: ok === true, sep: window.relayerSDK.SepoliaConfig };
    } catch (error) {
      return { ok: false, error: String(error && error.message || error) };
    }
  });
  assert(sdkInit.ok === true, 'initSDK() loads TFHE + KMS WASM without __wbindgen_malloc errors');
  assert(typeof sdkInit.sep === 'object' && /^https:\/\//.test(sdkInit.sep.relayerUrl), 'SepoliaConfig ships an https relayer URL');

  await page.screenshot({ path: path.join(outputDir, 'bugfix-home.png') });

  const draw = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  draw.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push('draw: ' + msg.text()); });
  draw.on('response', (res) => { if (res.status() >= 400) failedRequests.push(res.status() + ' ' + res.url()); });
  await draw.goto(baseURL + 'draw', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await draw.locator('#drawStage').waitFor({ timeout: 10000 });
  await draw.waitForFunction(() => {
    const el = document.querySelector('#drawStage');
    return el && !el.textContent.startsWith('CHECKING') && !el.textContent.startsWith('STATE UNREADABLE');
  }, { timeout: 30000 }).catch(() => {});
  const drawState = await draw.locator('#drawStage').textContent();
  const participants = await draw.locator('#drawParticipants').textContent();
  const settlement = await draw.locator('#drawSettlement').textContent();
  const enterLabel = await draw.locator('#enter').textContent();
  const openLabel = await draw.locator('#open').textContent();
  const claimLabel = await draw.locator('#claim').textContent();
  const bodyText = (await draw.locator('body').textContent()) || '';
  const enterDisabled = await draw.locator('#enter').isDisabled();
  const openDisabled = await draw.locator('#open').isDisabled();
  const claimDisabled = await draw.locator('#claim').isDisabled();
  console.log('DRAW STATE:', drawState.trim(), '| participants:', participants.trim(), '| settlement:', settlement.trim());
  console.log('BUTTONS:', enterLabel.trim(), '/', openLabel.trim(), '/', claimLabel.trim());
  assert(/OPEN|ENTERED|ROUND COMPLETE|CLOSED|AWAITING/.test(drawState), 'draw page shows the truthful on-chain stage instead of a static label');
  assert(participants.trim() !== '-' && participants.trim() !== '', 'participant count is populated from chain');
  assert(settlement.trim() !== '-' && settlement.trim() !== '', 'settlement progress is populated from chain');
  assert(bodyText.includes('LIVE DEMO DRAW CONTRACT'), 'draw page exposes the fresh live-demo draw contract and separates it from canonical evidence');
  assert(enterDisabled === true, 'enter action is disabled while no wallet is connected on the live demo round');
  assert(openDisabled === true, 'open action is disabled when it would revert on-chain');
  assert(claimDisabled === true || /CLAIM/.test(claimLabel), 'claim action reflects reserve state');
  await draw.screenshot({ path: path.join(outputDir, 'bugfix-draw.png') });

  const routes = ['commitment', 'proof', 'proof/contracts'];
  for (const route of routes) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto(baseURL + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.locator('h1').first().waitFor({ timeout: 15000 });
    const routeBody = (await p.locator('body').innerText()) || '';
    if (route === 'commitment') {
      assert(routeBody.includes('ILLUSTRATIVE'), 'commitment page labels its example state as illustrative while disconnected');
      assert(routeBody.includes('TESTNET DEMO DEPOSIT'), 'commitment page exposes the explicit testnet demo funding action');
      assert(!routeBody.includes('$150'), 'no dollar-denominated hardcoded balance is shown on the commitment page');
    }
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert(!overflow, route + ' has no horizontal overflow');
    await p.close();
  }

  const fatalAssetMisses = failedRequests.filter((url) => /relayer-sdk-js|tfhe_bg|kms_lib_bg|workerHelpers/.test(url));
  assert(fatalAssetMisses.length === 0, 'no 404/failed requests for Zama runtime assets: ' + (fatalAssetMisses.join(' | ') || 'none'));
  console.log('CONSOLE ERRORS:', consoleErrors.slice(0, 10));
  console.log('ALL RESPONSE/REQUEST ISSUES:', failedRequests.slice(0, 10));
  await browser.close();
  console.log('BUGFIX CHECK COMPLETE');
})().catch((error) => {
  console.error('BUGFIX CHECK FAILED:', error && error.message || error);
  process.exit(1);
});
