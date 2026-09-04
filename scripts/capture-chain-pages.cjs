const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const executablePath = 'C:/Users/hp/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const outputDir = path.join(process.cwd(), 'evidence', 'live');
fs.mkdirSync(outputDir, { recursive: true });

const pages = [
  {
    name: 'season4-brief',
    url: 'https://forms.zama.org/developer-program-mainnet-season4-bounty-track'
  },
  {
    name: 'pool-etherscan',
    url: 'https://sepolia.etherscan.io/address/0x01D566D52814b924D58306627731B1494A6f96e8#code'
  },
  {
    name: 'draw-etherscan',
    url: 'https://sepolia.etherscan.io/address/0x2D7612D2518C5e9FF38858ee951ad45cdDf49F45#code'
  },
  {
    name: 'reserve-etherscan',
    url: 'https://sepolia.etherscan.io/address/0x1f039137Fa9C67BF5b6ba415A7c146F811fD12f5#code'
  },
  {
    name: 'asset-etherscan',
    url: 'https://sepolia.etherscan.io/address/0x7427c89Ce75eD4f06e96149402e39b08773Ba4e6#code'
  }
];

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const report = { generatedAt: new Date().toISOString(), executablePath, pages: [] };
  try {
    for (const target of pages) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
      const startedAt = Date.now();
      try {
        const response = await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2500);
        const title = await page.title();
        const status = response ? response.status() : null;
        const screenshot = `${target.name}.png`;
        await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: true });
        report.pages.push({ name: target.name, url: target.url, httpStatus: status, title, screenshot, elapsedMs: Date.now() - startedAt, pass: status === null || status < 400 });
      } catch (error) {
        report.pages.push({ name: target.name, url: target.url, elapsedMs: Date.now() - startedAt, pass: false, error: error.message });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(outputDir, 'capture-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.pages.some((item) => !item.pass)) process.exitCode = 1;
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });
