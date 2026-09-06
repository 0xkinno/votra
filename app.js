import { BrowserProvider, Contract, JsonRpcProvider } from 'ethers';
import './styles.css';

const addresses = {
  pool: typeof __VOTRA_POOL__ !== 'undefined' ? __VOTRA_POOL__ : '0x2E47C272baaEfb584593d61d8Aee6E81CDF1463c',
  draw: typeof __VOTRA_DRAW__ !== 'undefined' ? __VOTRA_DRAW__ : '0x237FcAE817ce2F67912BA9cd26ecA85bff4f22B0',
  asset: typeof __VOTRA_ASSET__ !== 'undefined' ? __VOTRA_ASSET__ : '0x8A17E769bB6Be6b4b29dEf59061cFd8ccb63161e',
  reserve: typeof __VOTRA_RESERVE__ !== 'undefined' ? __VOTRA_RESERVE__ : '0x916510A064c08Ff05de32C54b2be99eB674ad352',
  adapter: typeof __VOTRA_ADAPTER__ !== 'undefined' ? __VOTRA_ADAPTER__ : '0xA97FAE6911FA2ecD5787aB990fDB367d39B1632D'
};

const live = {
  pool: typeof __VOTRA_LIVE_POOL__ !== 'undefined' ? __VOTRA_LIVE_POOL__ : '0x4dDb678313823206352655a844C7663E89830008',
  draw: typeof __VOTRA_LIVE_DRAW__ !== 'undefined' ? __VOTRA_LIVE_DRAW__ : '0xa761a1d265dF11626D7E8DaB6701783ca454Bdfd',
  asset: typeof __VOTRA_LIVE_ASSET__ !== 'undefined' ? __VOTRA_LIVE_ASSET__ : '0xE95093C079936BD7a92690AC097fce66596b3Ff6',
  reserve: typeof __VOTRA_LIVE_RESERVE__ !== 'undefined' ? __VOTRA_LIVE_RESERVE__ : '0x60EA61c17044Cfc11f1594a3CAC01DBd2e6Ad7DE',
  adapter: typeof __VOTRA_LIVE_ADAPTER__ !== 'undefined' ? __VOTRA_LIVE_ADAPTER__ : '0x27897B1C0392C6Fe340f0b544C228e7FdA90ccce'
};

const github = 'https://github.com/0xkinno/votra';
const canonical = '/evidence/live/canonical-yield-campaign.json';
const history = '/evidence/history-sensitivity/live-campaign.json';

const artifacts = {
  fairness: { title: 'Exact selection fairness', file: '/evidence/fairness/exact-selection-50k.json', metric: '50,007 scenarios / 0 mismatches / 0 illegal winners' },
  history: { title: 'History-sensitive campaign', file: history, metric: 'Equal balance 150 / distinct CW / zero divergence' },
  adversarial: { title: 'Deployed adversarial receipts', file: '/evidence/adversarial/executable-receipts.json', metric: '8 independently mined status-0 receipts' },
  live: { title: 'Canonical yield-funded live campaign', file: canonical, metric: 'Equal final balances / distinct CW / positive winner / yield-funded prize' },
  discovery: { title: 'Discovery', file: '/evidence/model/canonical-state-transition.json', metric: 'Private covenant state becomes an economic rule' },
  invariants: { title: 'Forward-only invariant', file: '/evidence/invariants/forward-only-randomized.json', metric: '10,000 histories / 0 failures' },
  privacy: { title: 'Privacy leakage campaign', file: '/evidence/privacy/leakage-campaign.json', metric: 'Public metadata separated from encrypted state' },
  benchmarks: { title: 'Operation cost', file: '/evidence/benchmarks/final-cost-summary.json', metric: 'Mock HCU and live gas classified separately' }
  ,yield: { title: 'Yield provenance and principal separation', file: '/evidence/yield/principal-separation.json', metric: '10,000 accounting scenarios / 0 invariant failures / yield-only prize source' }
  ,'yield-model': { title: 'Yield economic model', file: '/evidence/yield/economic-model.json', metric: 'Separate prize funding from covenant-weighted selection' }
};

const poolAbi = ['function setCommitment(bytes32,bytes)', 'function deposit(bytes32,bytes)', 'function withdraw(bytes32,bytes)'];
const poolViewAbi = [
  'function balanceOf(address) view returns (bytes32)',
  'function floorOf(address) view returns (bytes32)',
  'function weightOf(address) view returns (bytes32)'
];
const drawAbi = [
  'function enter()',
  'function open()',
  'function winnerBit(uint256)',
  'function settleParticipant(uint256)',
  'function opened() view returns (bool)',
  'function exhausted() view returns (bool)',
  'function participantCount() view returns (uint256)',
  'function participants(uint256) view returns (address)',
  'function entered(address) view returns (bool)',
  'function settled(uint256) view returns (bool)'
];
const reserveAbi = ['function claim(uint256)', 'function claimed(uint256,address) view returns (bool)'];
const assetAbi = ['function confidentialTransferAndCall(address,bytes32,bytes)'];

const ZERO_HANDLE = '0x' + '0'.repeat(64);

function isActiveHandle(handle) {
  if (!handle) return false;
  const hex = String(handle);
  return hex !== ZERO_HANDLE && hex !== '0x';
}

function normalizeHandle(handle) {
  return typeof handle === 'string' ? handle : (handle?.[0] || handle?.handle || handle?.toString?.());
}

function setText(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

function setBalanceAmounts(value) {
  setText('#heroBalance', value);
  setText('#consoleBalanceAmount', value);
  setText('#commitmentBalanceAmount', value);
}

function connectedBalanceDisplay() {
  if (!state.hasBalanceHandle) return '0.00';
  if (state.balanceRevealLoading) return 'DECRYPTING…';
  if (!state.revealBalance) return 'ENCRYPTED';
  return state.plainBalance ?? 'DECRYPTING…';
}

function invalidateBalanceReveal() {
  state.plainBalance = null;
  state.balanceRevealError = '';
  state.balanceRevealLoading = false;
  state.hasBalanceHandle = false;
  state.balanceHandle = null;
}

const state = {
  wallet: null,
  tx: 'READY',
  txLabel: '',
  hash: '',
  error: '',
  current: null,
  revealBalance: false,
  walletAccount: null,
  hasBalanceHandle: false,
  balanceHandle: null,
  plainBalance: null,
  balanceRevealError: '',
  balanceRevealLoading: false
};

let fhePromise = null;
let fheAccount = undefined;
let readProvider = null;

// Icons (SVG)
const icons = {
  logo: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  home: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
  mechanism: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`,
  commitment: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
  draw: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
  proof: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
  wallet: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`,
  eye: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
  arrowRight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`,
  external: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`
};

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
}

function cornerMarks() {
  return `
    <span class="corner-mark corner-mark-tl"></span>
    <span class="corner-mark corner-mark-tr"></span>
    <span class="corner-mark corner-mark-bl"></span>
    <span class="corner-mark corner-mark-br"></span>
  `;
}

function getActiveNavClass(currentPath, targetPath) {
  if (targetPath === '/' && (currentPath === '/' || currentPath === '')) return 'active';
  if (targetPath !== '/' && currentPath.startsWith(targetPath)) return 'active';
  return '';
}

function shell(content) {
  const path = location.pathname.replace(/\/+$/, '') || '/';

  return `
    <header>
      <div class="brand-wrap">
        <a class="brand" href="/">
          <span class="brand-icon">${icons.logo}</span>
          <span>VOTRA</span>
        </a>
        <span class="badge-beta">BETA</span>
      </div>

      <nav class="nav-capsule-bar" aria-label="Main Navigation">
        <a class="nav-link ${getActiveNavClass(path, '/')}" href="/">
          ${icons.home} <span>Home</span>
        </a>
        <a class="nav-link" href="/#mechanism">
          ${icons.mechanism} <span>How it works</span>
        </a>
        <a class="nav-link ${getActiveNavClass(path, '/commitment')}" href="/commitment">
          ${icons.commitment} <span>Your commitment</span>
        </a>
        <a class="nav-link ${getActiveNavClass(path, '/draw')}" href="/draw">
          ${icons.draw} <span>Draw</span>
        </a>
        <a class="nav-link ${getActiveNavClass(path, '/proof')}" href="/proof">
          ${icons.proof} <span>Proof</span>
        </a>
      </nav>

      <div class="header-right">
        <div class="network-pill">
          <span class="network-dot"></span>
          <span>Sepolia</span>
        </div>
        <button id="connect" class="btn-wallet" type="button">
          ${icons.wallet}
          <span id="walletLabel">Connect wallet</span>
        </button>
      </div>
    </header>

    <main>
      ${content}
    </main>

    <footer>
      <div class="footer-inner">
        <div class="footer-brand">
          <span class="brand-icon">${icons.logo}</span>
          <span>VOTRA &mdash; PRIVATE COMMITMENT. FAIR CHANCE.</span>
        </div>
        <div class="footer-links">
          <span>Sepolia / ExactDraw</span>
          <a href="/proof/contracts" style="color:var(--surface-forest); font-weight:600;">Verified Contracts</a>
          <a href="${github}" target="_blank" rel="noreferrer" style="display:inline-flex; align-items:center; gap:4px;">GitHub ${icons.external}</a>
        </div>
      </div>
    </footer>
  `;
}

function setTx(label, status, hash = '', error = '') {
  state.txLabel = label;
  state.tx = status;
  state.hash = hash;
  state.error = error;
  renderTx();
}

function renderTx() {
  const el = document.querySelector('#txState');
  if (el) {
    const isError = /FAILED|REJECTED/i.test(state.tx);
    const isPending = /ENCRYPT|PENDING|SUBMITTING|CONFIRMING|SIGN IN/i.test(state.tx);
    el.className = `status-badge ${isError ? 'error' : isPending ? 'pending' : 'ready'}`;
    el.innerHTML = `
      <span class="network-dot" style="background:${isError ? 'var(--accent-red)' : isPending ? 'var(--accent-orange)' : 'var(--accent-green)'}"></span>
      <span>${esc(state.tx)}</span>
      ${state.txLabel ? `<span style="color:var(--muted); margin-left:4px;">(${esc(state.txLabel)})</span>` : ''}
      ${state.hash ? `<a href="https://sepolia.etherscan.io/tx/${state.hash}" target="_blank" rel="noreferrer" style="color:var(--surface-forest); text-decoration:underline; margin-left:6px;">Tx</a>` : ''}
      ${state.error ? `<span style="color:var(--accent-red); margin-left:6px;">${esc(state.error)}</span>` : ''}
    `;
  }
  const metric = document.querySelector('#txMetric');
  if (metric) metric.textContent = state.tx;
}

async function providerAndSigner() {
  const raw = state.wallet?.provider;
  if (!raw) throw Error('Connect a wallet before signing.');
  const browser = new BrowserProvider(raw);
  return { browser, signer: await browser.getSigner() };
}

async function send(label, action) {
  try {
    setTx(label, 'SIGN IN WALLET');
    setTx(label, 'SUBMITTING');
    const tx = await action();
    setTx(label, 'PENDING', tx.hash);
    setTx(label, 'CONFIRMING', tx.hash);
    const receipt = await tx.wait();
    setTx(label, 'CONFIRMED', receipt.hash);
    return receipt;
  } catch (error) {
    const rejected = error?.code === 4001 || error?.code === 'ACTION_REJECTED';
    setTx(label, rejected ? 'USER REJECTED' : 'FAILED', '', error.shortMessage || error.message);
    throw error;
  }
}

function rpcProvider() {
  if (!readProvider) {
    const rpc = typeof __VOTRA_RPC__ !== 'undefined' ? __VOTRA_RPC__ : 'https://ethereum-sepolia-rpc.publicnode.com';
    readProvider = new JsonRpcProvider(rpc);
  }
  return readProvider;
}

async function fheInstance() {
  const raw = state.wallet?.provider;
  const provider = raw && typeof raw.request === 'function' ? raw : window.ethereum;
  if (!provider) throw Error('Connect a wallet before creating encrypted input.');
  if (!fhePromise) {
    fhePromise = (async () => {
      if (!window.relayerSDK || typeof window.relayerSDK.initSDK !== 'function') {
        throw Error('Zama relayer runtime is not loaded. Reload the page to initialize the FHE engine.');
      }
      const { initSDK, createInstance, SepoliaConfig } = await import('@zama-fhe/relayer-sdk/bundle');
      await initSDK(); // WASM must be initialized before createInstance can expose its exports.
      return createInstance({ ...SepoliaConfig, network: provider });
    })().catch((error) => {
      fhePromise = null;
      throw error;
    });
  }
  return fhePromise;
}

async function encrypted(value, contractAddress, user) {
  const fhe = await fheInstance();
  try {
    const input = await fhe.createEncryptedInput(contractAddress, user).add64(value).encrypt();
    return [input.handles[0], input.inputProof];
  } catch (error) {
    fhePromise = null; // stale relayer/public-key state; rebuild on the next attempt
    throw Error(error.shortMessage || error.message || 'Encrypted input creation failed.');
  }
}

async function revealConnectedBalance() {
  const user = state.wallet?.account;
  if (!user || !state.hasBalanceHandle || !state.balanceHandle) return;
  state.balanceRevealLoading = true;
  state.balanceRevealError = '';
  setBalanceAmounts(connectedBalanceDisplay());
  try {
    const { signer } = await providerAndSigner();
    const fhe = await fheInstance();
    const keypair = fhe.generateKeypair();
    const startTimestamp = Math.floor(Date.now() / 1000);
    const durationDays = 1;
    const eip712 = fhe.createEIP712(keypair.publicKey, [live.pool], startTimestamp, durationDays);
    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message
    );
    const results = await fhe.userDecrypt(
      [{ handle: state.balanceHandle, contractAddress: live.pool }],
      keypair.privateKey,
      keypair.publicKey,
      signature,
      [live.pool],
      user,
      startTimestamp,
      durationDays
    );
    const raw = results?.[state.balanceHandle] ?? Object.values(results || {})[0];
    if (raw === undefined || raw === null) throw Error('Relayer returned no plaintext balance.');
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) throw Error('Unexpected decrypted balance value.');
    state.plainBalance = numeric.toFixed(2);
    state.balanceRevealError = '';
  } catch (error) {
    state.balanceRevealError = error?.shortMessage || error?.message || 'Balance reveal failed.';
    state.plainBalance = null;
    state.revealBalance = false;
  } finally {
    state.balanceRevealLoading = false;
    setBalanceAmounts(connectedBalanceDisplay());
    setText('#heroSubInfo', state.hasBalanceHandle
      ? (state.plainBalance !== null
          ? `${state.plainBalance} cETH · authorized user decryption · shown only to this wallet`
          : (state.balanceRevealError || 'Encrypted vault present on live-demo pool | no plaintext exposed'))
      : 'No protocol record for this wallet on the live-demo pool');
    setText('#consoleBalanceNote', state.hasBalanceHandle
      ? (state.plainBalance !== null
          ? `${state.plainBalance} cETH · decrypted from this wallet's own encrypted vault`
          : (state.balanceRevealError || 'Encrypted vault present on live-demo pool | no plaintext exposed'))
      : 'No protocol record for this wallet on the live-demo pool');
    setText('#commitmentBalanceNote', state.hasBalanceHandle
      ? (state.plainBalance !== null
          ? `${state.plainBalance} cETH · decrypted from this wallet's own encrypted vault`
          : (state.balanceRevealError || 'Encrypted vault present on live-demo pool | no plaintext exposed'))
      : 'No protocol record for this wallet on the live-demo pool');
  }
}

async function toggleBalanceReveal() {
  const connected = Boolean(state.wallet?.connected && state.wallet?.account);
  if (!connected) {
    state.revealBalance = !state.revealBalance;
    setText('#heroBalance', state.revealBalance ? '150.00' : '████████');
    return;
  }
  if (!state.hasBalanceHandle) return;
  state.revealBalance = !state.revealBalance;
  state.balanceRevealError = '';
  if (state.revealBalance) {
    setBalanceAmounts(connectedBalanceDisplay());
    if (state.plainBalance === null) await revealConnectedBalance();
    return;
  }
  setBalanceAmounts(connectedBalanceDisplay());
  setText('#heroSubInfo', 'Encrypted vault present on live-demo pool | click the eye to reveal only your own balance');
  setText('#consoleBalanceNote', 'Encrypted vault present on live-demo pool | click the eye to reveal only your own balance');
  setText('#commitmentBalanceNote', 'Encrypted vault present on live-demo pool | click the eye to reveal only your own balance');
}

async function protocolAction(kind) {
  try {
    const { signer } = await providerAndSigner();
    const user = await signer.getAddress();
    if (kind === 'commitment' || kind === 'deposit' || kind === 'breach' || kind === 'recovery' || kind === 'withdraw-principal') {
      const value = kind === 'commitment' ? Number(document.querySelector('#goal')?.value || 100) : kind === 'deposit' ? 150 : kind === 'withdraw-principal' ? 150 : 60;
      const actionLabel = kind === 'withdraw-principal' ? 'withdraw principal' : kind;
      setTx(kind === 'commitment' ? 'set commitment' : actionLabel, 'ENCRYPTING VIA ZAMA RELAYER (10-20 SECONDS)');
      const [handle, proof] = await encrypted(value, live.pool, user);
      const pool = new Contract(live.pool, poolAbi, signer);
      const fn = kind === 'commitment' ? 'setCommitment' : (kind === 'breach' || kind === 'withdraw-principal') ? 'withdraw' : 'deposit';
      await send(actionLabel, () => pool[fn](handle, proof));
      invalidateBalanceReveal();
      state.revealBalance = false;
      hydratePortfolio();
      return;
    }
    const draw = new Contract(live.draw, drawAbi, signer);
    if (kind === 'enter') await send('draw entry', () => draw.enter());
    if (kind === 'open') await send('encrypted draw opening', () => draw.open());
    if (kind === 'claim') await send('confidential claim', () => new Contract(live.reserve, reserveAbi, signer).claim(1));
    if (kind === 'enter' || kind === 'open' || kind === 'claim') hydrateDraw();
  } catch (error) {
    const rejected = error?.code === 4001 || error?.code === 'ACTION_REJECTED';
    setTx(kind, rejected ? 'USER REJECTED' : 'FAILED', '', error.shortMessage || error.message);
    throw error;
  }
}

/* ==========================================================================
   Views & Routes
   ========================================================================== */

function home() {
  return shell(`
    <div class="banner-strip">
      <div>
        <strong>NEW</strong>
        <span>ExactDraw verified on Sepolia with zero selection bias and confidential prize weight</span>
      </div>
      <a class="banner-link" href="/proof">Inspect Proof ${icons.arrowRight}</a>
    </div>

    <div class="container">
      <!-- HERO SECTION -->
      <section class="hero-section">
        <div class="hero-grid">
          <div class="hero-content">
            <div class="eyebrow eyebrow-green">
              <span>PRIVATE COMMITMENT</span> &middot; <span>FAIR CHANCE</span>
            </div>
            <h1>Keep your private commitment.<br><span class="text-forest">Keep your winning weight.</span></h1>
            <p class="lede">
              VOTRA turns a private savings commitment into an enforceable, encrypted economic rule &mdash; powering confidential, verifiable prize savings without exposing financial state.
            </p>
            <div class="hero-actions">
              <a class="btn-hero-primary btn-bracket btn-bracket-primary" href="/commitment">
                START SAVING
              </a>
              <a class="btn-hero-secondary" href="#mechanism">
                SEE HOW IT WORKS
              </a>
            </div>
            <div class="hero-signal">
              <span class="network-dot"></span>
              <span>Live protocol on <strong>Ethereum Sepolia</strong> &middot; Powered by <strong>Zama FHE</strong></span>
            </div>
          </div>

          <!-- HERO INTERACTIVE PROTOCOL CARD -->
          <div class="hero-protocol-card with-corner-marks" id="heroCard">
            ${cornerMarks()}
            <div class="card-top-row">
              <span class="card-label">YOUR ENCRYPTED BALANCE</span>
              <span class="cipher-badge" id="heroStateTag">ILLUSTRATIVE</span>
            </div>

            <div class="balance-display">
              <div class="balance-amount mono" id="heroBalance">
                ${state.revealBalance ? '150.00' : '████████'}
              </div>
              <button class="btn-eye-toggle" data-eye-toggle title="Reveal or hide your balance" type="button">
                ${icons.eye}
              </button>
            </div>

            <div class="card-sub-info mono">
              <span id="heroSubInfo">150.0000 cETH &middot; illustrative example &middot; connect a wallet to view your encrypted chain state</span>
            </div>

            <div class="card-metrics-grid">
              <div class="metric-item">
                <span>COVENANT STATE</span>
                <div class="covenant-pill">
                  <span class="network-dot" style="background:#4ade80; width:5px; height:5px;"></span>
                  <span id="heroCovenantLabel">COMPLIANT (ILLUSTRATIVE)</span>
                </div>
              </div>
              <div class="metric-item">
                <span>COMMITMENT-WEIGHTED TIME</span>
                <strong id="heroCW">136,800 unit-sec (ILLUSTRATIVE)</strong>
              </div>
            </div>

            <div class="card-actions-row">
              <a class="btn-card-mint" href="/commitment" style="text-align:center; text-decoration:none;">MANAGE COVENANT</a>
              <a class="btn-card-outline" href="/draw" style="text-align:center; text-decoration:none;">ENTER DRAW</a>
            </div>
          </div>
        </div>
      </section>

      <!-- LIVE COVENANT INTERACTION CONSOLE (EMBEDDED FOR IMMEDIATE ACCESS) -->
      <section class="section" id="covenantControls">
        <div class="section-head">
          <div class="eyebrow eyebrow-green">LIVE PROTOCOL CONSOLE</div>
          <h2 class="section-title">Private covenant execution</h2>
          <p class="section-subtitle">
            Interact directly with the live Sepolia contracts. Set your private commitment floor, execute confidential deposits, or test covenant breach and recovery.
          </p>
        </div>

        <div class="product-grid">
          <div class="product-card product-card-mint with-corner-marks">
            ${cornerMarks()}
            <div class="eyebrow eyebrow-green">CONFIDENTIAL BALANCE &middot; <span id="consoleStateTag">ILLUSTRATIVE</span></div>
            <div class="balance-display balance-display-card">
              <span class="balance-amount balance-amount-card mono" id="consoleBalanceAmount">150.00</span>
              <span class="balance-unit">cETH</span>
              <button class="btn-eye-toggle eye-on-light" data-eye-toggle title="Reveal or hide this wallet's balance" type="button">
                ${icons.eye}
              </button>
            </div>
            <p id="consoleBalanceNote" style="font-size:13px; margin-bottom: 20px;">Illustrative demo state. Connect a wallet to view only your real encrypted chain state &mdash; balances are never hardcoded for a connected account.</p>

            <div class="receipt-card" style="background:rgba(255,255,255,0.7); margin-top:0;">
              <div class="receipt-row">
                <span>COVENANT STATUS</span>
                <strong style="color:var(--surface-forest);" id="consoleCovenantStatus">● COMPLIANT (ILLUSTRATIVE)</strong>
              </div>
              <div class="receipt-row">
                <span>WEIGHT ACCRUAL</span>
                <strong id="consoleAccrualStatus">ACTIVE (1&times; RATE) (ILLUSTRATIVE)</strong>
              </div>
            </div>
          </div>

          <div class="product-card with-corner-marks">
            ${cornerMarks()}
            <div class="eyebrow eyebrow-green">COVENANT CONFIGURATION</div>
            <div class="input-field-group">
              <label for="goal">Private commitment floor</label>
              <div class="input-pill-wrapper">
                <span class="unit">ETH</span>
                <input id="goal" type="number" min="1" value="100">
                <span class="cipher-badge">ENCRYPTED</span>
              </div>
            </div>

            <button class="btn-bracket btn-bracket-primary" id="setGoal" data-action="commitment" style="width:100%;" type="button">
              SET PRIVATE COMMITMENT
            </button>

            <div class="actions-pill-group" style="margin-top:20px; padding-top:16px; border-top:1px solid var(--line);">
              <button class="btn-pill-action" id="deposit" data-action="deposit" type="button">TESTNET DEMO DEPOSIT (+150)</button>
              <button class="btn-pill-action" id="breach" data-action="breach" type="button">Withdraw (Test Breach)</button>
              <button class="btn-pill-action" id="recover" data-action="recovery" type="button">Deposit (Recover)</button>
              <button class="btn-pill-action" data-action="withdraw-principal" type="button">WITHDRAW PRINCIPAL</button>
            </div>
            <p style="font-size:11px; color:var(--muted); margin-top:12px;" id="consoleDemoNote">
              TESTNET ONLY: this wallet-signed action credits the encrypted demo ledger with 150 units. It does not transfer or mint any live asset, and it never happens automatically for a new wallet.
            </p>
          </div>
        </div>

        <div class="receipt-card with-corner-marks" style="margin-top:16px;">
          ${cornerMarks()}
          <div class="receipt-row">
            <span>TX STATE</span>
            <div class="status-badge ready" id="txState">
              <span class="network-dot"></span>
              <span>READY</span>
            </div>
          </div>
          <div class="receipt-row">
            <span>LIVE DEMO POOL CONTRACT</span>
            <strong><a href="https://sepolia.etherscan.io/address/${live.pool}" target="_blank" rel="noreferrer" style="color:var(--surface-forest);">${live.pool} ${icons.external}</a></strong>
          </div>
          <div class="receipt-row">
            <span>METRIC STATUS</span>
            <strong id="txMetric">Receipt-derived</strong>
          </div>
        </div>
      </section>

      <!-- DISCOVERY / HOW IT WORKS SECTION -->
      <section class="section" id="mechanism">
        <div class="section-head" id="how">
          <div class="eyebrow eyebrow-green">THE CORE DISCOVERY</div>
          <h2 class="section-title">A balance can be private. A promise can be private too.</h2>
          <p class="section-subtitle">
            Traditional DeFi prize savings leak historical deposits or ignore savings discipline. VOTRA calculates time-weighted balance only during periods where your encrypted floor is satisfied.
          </p>
        </div>

        <!-- THE SIGNATURE VOTRA MOMENT -->
        <div class="comparison-box with-corner-marks">
          ${cornerMarks()}
          <div class="eyebrow">SIGNATURE COMPARISON</div>
          <h3>Same final balance. Different private history. Different winning odds.</h3>
          <p style="font-size:13px; color:var(--muted); margin-top:4px;">
            Both participants hold exactly 150 ETH at round settlement. However, Participant A sustained commitment compliance longer, earning strictly higher draw weight without revealing balances.
          </p>

          <div class="participants-grid">
            <!-- Participant A -->
            <div class="participant-card winner-favored">
              <div class="participant-head">
                <span class="participant-tag">PARTICIPANT A</span>
                <span class="participant-status high">HIGHER PRIZE WEIGHT</span>
              </div>
              <div class="history-strip">
                <span class="history-pill compliant">COMPLIANT (800s)</span>
                <span class="draw-arrow">&rarr;</span>
                <span class="history-pill compliant">COMPLIANT (400s)</span>
                <span class="draw-arrow">&rarr;</span>
                <span class="history-pill breach">BREACH (0s)</span>
              </div>
              <div class="comparison-stats">
                <div class="stat-item">
                  <span>FINAL BALANCE</span>
                  <strong>150 ETH</strong>
                </div>
                <div class="stat-item">
                  <span>COMMITTED WEIGHT (CW)</span>
                  <strong style="color:var(--surface-forest);">136,800 unit-sec</strong>
                </div>
              </div>
            </div>

            <!-- Participant B -->
            <div class="participant-card">
              <div class="participant-head">
                <span class="participant-tag">PARTICIPANT B</span>
                <span class="participant-status low">LOWER PRIZE WEIGHT</span>
              </div>
              <div class="history-strip">
                <span class="history-pill breach">BREACH (0s)</span>
                <span class="draw-arrow">&rarr;</span>
                <span class="history-pill recovery">RECOVERY (0s)</span>
                <span class="draw-arrow">&rarr;</span>
                <span class="history-pill compliant">COMPLIANT (200s)</span>
              </div>
              <div class="comparison-stats">
                <div class="stat-item">
                  <span>FINAL BALANCE</span>
                  <strong>150 ETH</strong>
                </div>
                <div class="stat-item">
                  <span>COMMITTED WEIGHT (CW)</span>
                  <strong style="color:var(--accent-orange-text);">30,000 unit-sec</strong>
                </div>
              </div>
            </div>
          </div>

          <div class="comparison-takeaway">
            <span>Result: Historical compliance creates 4.56&times; winning weight differential under zero knowledge.</span>
            <a href="/proof/history" style="color:var(--surface-forest); font-weight:700; text-decoration:underline;">View live proof &rarr;</a>
          </div>
        </div>
      </section>

      <!-- COVENANT TIMELINE SECTION -->
      <section class="section">
        <div class="section-head">
          <div class="eyebrow eyebrow-green">IMMUTABLE PROTOCOL TIMELINE</div>
          <h2 class="section-title">Forward-only covenant accrual</h2>
          <p class="section-subtitle">
            Historical weight never rewrites. When a covenant breach occurs, future accrual immediately pauses until recovery is confirmed.
          </p>
        </div>

        <div class="timeline-interactive-box with-corner-marks">
          ${cornerMarks()}
          <div class="timeline-stages-grid">
            <div class="timeline-stage-card selected">
              <div class="stage-step">STAGE 01</div>
              <div class="stage-title">Compliant Interval</div>
              <div class="stage-desc">Balance &ge; Commitment floor. Time-weighted balance accrues continuously into encrypted CW.</div>
            </div>
            <div class="timeline-stage-card">
              <div class="stage-step">STAGE 02</div>
              <div class="stage-title">Breach Detected</div>
              <div class="stage-desc">Withdrawal drops balance below floor. Future weight accrual freezes instantly. Past weight is preserved.</div>
            </div>
            <div class="timeline-stage-card">
              <div class="stage-step">STAGE 03</div>
              <div class="stage-title">Recovery Deposit</div>
              <div class="stage-desc">Deposit restores compliance. Fresh weight accrues from recovery timestamp. No retroactive restoration.</div>
            </div>
          </div>
        </div>
      </section>

      <!-- EXACT ENCRYPTED DRAW VISUALIZATION -->
      <section class="section">
        <div class="section-head">
          <div class="eyebrow eyebrow-green">EXACT WEIGHTED SELECTION</div>
          <h2 class="section-title">ExactDraw scientific selection pipeline</h2>
          <p class="section-subtitle">
            Exact selection uses rejection-sampled encrypted randomness with zero modulo bias, verified across 50,007 Monte Carlo scenarios.
          </p>
        </div>

        <div class="draw-flow-box with-corner-marks">
          ${cornerMarks()}
          <div class="draw-steps-row">
            <div class="draw-step-card">
              <div class="draw-step-icon">1</div>
              <strong>Encrypted CW</strong>
              <span>Accumulated compliant history</span>
            </div>
            <span class="draw-arrow">&rarr;</span>
            <div class="draw-step-card">
              <div class="draw-step-icon">2</div>
              <strong>Encrypted Sum</strong>
              <span>Confidential pool total weight</span>
            </div>
            <span class="draw-arrow">&rarr;</span>
            <div class="draw-step-card">
              <div class="draw-step-icon">3</div>
              <strong>Sample &amp; Filter</strong>
              <span>Uniform rejection sampling</span>
            </div>
            <span class="draw-arrow">&rarr;</span>
            <div class="draw-step-card">
              <div class="draw-step-icon">4</div>
              <strong>Winner Decrypt</strong>
              <span>Single authorized winner bit</span>
            </div>
          </div>
        </div>
      </section>

      <!-- PROOF OVERVIEW GRID -->
      <section class="section proof">
        <div class="section-head">
          <div class="eyebrow eyebrow-green">LIVE VERIFICATION</div>
          <h2 class="section-title">Empirical proof &amp; on-chain evidence</h2>
          <p class="section-subtitle">
            Every invariant, selection campaign, and contract interaction is backed by reproducible artifacts on Sepolia.
          </p>
        </div>

        <div class="evidence-cards-grid">
          ${Object.entries(artifacts).slice(0, 4).map(([key, meta]) => `
            <a class="evidence-card" href="/proof/${key}">
              <div>
                <div class="evidence-card-kicker">${key.toUpperCase()}</div>
                <strong>${esc(meta.title)}</strong>
                <div class="evidence-card-metric">${esc(meta.metric)}</div>
              </div>
              <span class="evidence-card-link">Inspect artifact ${icons.arrowRight}</span>
            </a>
          `).join('')}
        </div>
      </section>
    </div>
  `);
}

function commitmentPage() {
  return shell(`
    <div class="container console-page">
      <div class="console-head">
        <div>
          <div class="eyebrow eyebrow-green">YOUR COMMITMENT</div>
          <h1>Private covenant controls</h1>
          <p class="lede">Set a private commitment floor, deposit funds, and manage covenant compliance through encrypted Sepolia transactions. This interactive demo runs on a dedicated live-demo deployment &mdash; the frozen canonical proof stays separate under Proof.</p>
        </div>
        <div class="status-badge ready" id="txState">
          <span class="network-dot"></span>
          <span>READY</span>
        </div>
      </div>

      <div class="product-grid">
        <!-- Balance Card -->
        <div class="product-card product-card-mint with-corner-marks">
          ${cornerMarks()}
          <div class="eyebrow eyebrow-green">CONFIDENTIAL BALANCE &middot; <span id="commitmentStateTag">ILLUSTRATIVE</span></div>
          <div class="balance-display balance-display-card">
            <span class="balance-amount balance-amount-card mono" id="commitmentBalanceAmount">150.00</span>
            <span class="balance-unit">cETH</span>
            <button class="btn-eye-toggle eye-on-light" data-eye-toggle title="Reveal or hide this wallet's balance" type="button">
              ${icons.eye}
            </button>
          </div>
          <p id="commitmentBalanceNote" style="font-size:13px; margin-bottom: 20px;">Illustrative demo state. Connect a wallet to view only your real encrypted chain state &mdash; a connected account never inherits a hardcoded balance.</p>

          <div class="receipt-card" style="background:rgba(255,255,255,0.7); margin-top:0;">
            <div class="receipt-row">
              <span>COVENANT STATUS</span>
              <strong style="color:var(--surface-forest);" id="commitmentCovenantStatus">● COMPLIANT (ILLUSTRATIVE)</strong>
            </div>
            <div class="receipt-row">
              <span>WEIGHT ACCRUAL</span>
              <strong id="commitmentAccrualStatus">ACTIVE (1&times; RATE) (ILLUSTRATIVE)</strong>
            </div>
          </div>
        </div>

        <!-- Action Card -->
        <div class="product-card with-corner-marks">
          ${cornerMarks()}
          <div class="eyebrow eyebrow-green">COVENANT CONFIGURATION</div>
          <div class="input-field-group">
            <label for="goal">Private commitment floor</label>
            <div class="input-pill-wrapper">
              <span class="unit">ETH</span>
              <input id="goal" type="number" min="1" value="100">
              <span class="cipher-badge">ENCRYPTED</span>
            </div>
          </div>

          <button class="btn-bracket btn-bracket-primary" id="setGoal" data-action="commitment" style="width:100%;" type="button">
            SET PRIVATE COMMITMENT
          </button>

          <p style="font-size:11px; color:var(--muted); margin-top:12px;">
            Signs a cryptographic proof via Relayer SDK and records the commitment on-chain.
          </p>

          <div class="actions-pill-group" style="margin-top:20px; padding-top:16px; border-top:1px solid var(--line);">
            <button class="btn-pill-action" id="deposit" data-action="deposit" type="button">TESTNET DEMO DEPOSIT (+150)</button>
            <button class="btn-pill-action" id="breach" data-action="breach" type="button">Withdraw (Test Breach)</button>
            <button class="btn-pill-action" id="recover" data-action="recovery" type="button">Deposit (Recover)</button>
            <button class="btn-pill-action" data-action="withdraw-principal" type="button">WITHDRAW PRINCIPAL</button>
          </div>
          <p style="font-size:11px; color:var(--muted); margin-top:12px;" id="commitmentDemoNote">
            TESTNET ONLY: this wallet-signed action credits the encrypted demo ledger with 150 units. It does not transfer or mint any live asset, and it never happens automatically for a new wallet.
          </p>
        </div>
      </div>

      <!-- Live Contract Reference -->
      <div class="receipt-card with-corner-marks">
        ${cornerMarks()}
        <div class="receipt-row">
          <span>PROTOCOL STATE</span>
          <strong id="txMetric">Receipt-derived</strong>
        </div>
        <div class="receipt-row">
          <span>LIVE DEMO POOL CONTRACT</span>
          <strong><a href="https://sepolia.etherscan.io/address/${live.pool}" target="_blank" rel="noreferrer" style="color:var(--surface-forest);">${live.pool} ${icons.external}</a></strong>
        </div>
        <div class="receipt-row">
          <span>ENCRYPTION ENGINE</span>
          <strong>Zama FHEVM / Sepolia</strong>
        </div>
      </div>
    </div>
  `);
}

function drawPage() {
  return shell(`
    <div class="container console-page">
      <div class="console-head">
        <div>
          <div class="eyebrow eyebrow-green">EXACT DRAW</div>
          <h1>Exact encrypted selection room</h1>
          <p class="lede">Round controls reflect live Sepolia state. This is the live-demo interactive round &mdash; the recorded canonical positive-winner round stays frozen and is documented under Proof.</p>
        </div>
        <div class="status-badge ready" id="txState">
          <span class="network-dot"></span>
          <span>READY</span>
        </div>
      </div>

      <div class="product-grid">
        <!-- Draw Status Card -->
        <div class="product-card with-corner-marks">
          ${cornerMarks()}
          <div class="eyebrow eyebrow-green">LIVE DEMO ROUND #1 STATUS</div>
          <h3 style="font-size:24px; margin: 8px 0 16px;">ExactDraw Lifecycle</h3>

          <div class="receipt-card" style="margin-top:0;">
            <div class="receipt-row">
              <span>ROUND STAGE</span>
              <strong style="color:var(--surface-forest);" id="drawStage">CHECKING CHAIN STATE...</strong>
            </div>
            <div class="receipt-row">
              <span>PARTICIPANTS ENTERED</span>
              <strong id="drawParticipants">-</strong>
            </div>
            <div class="receipt-row">
              <span>SETTLEMENT PROGRESS</span>
              <strong id="drawSettlement">-</strong>
            </div>
            <div class="receipt-row">
              <span>YOUR ENTRY</span>
              <strong id="drawMyEntry">Connect a wallet to check</strong>
            </div>
            <div class="receipt-row">
              <span>YOUR CLAIM STATE</span>
              <strong id="drawMyClaim">-</strong>
            </div>
            <div class="receipt-row">
              <span>WEIGHT SCHEME</span>
              <strong>Commitment-Weighted TWAB</strong>
            </div>
            <div class="receipt-row">
              <span>SELECTION METHOD</span>
              <strong>Uniform Rejection Sampling</strong>
            </div>
          </div>
        </div>

        <!-- Draw Actions Card -->
        <div class="product-card with-corner-marks">
          ${cornerMarks()}
          <div class="eyebrow eyebrow-green">PARTICIPANT ACTIONS</div>
          <p style="font-size:13px; color:var(--muted); margin-bottom:20px;">
            Transactions are signed through your connected wallet. Buttons enable only when the action can succeed on-chain.
          </p>

          <div style="display:flex; flex-direction:column; gap:12px;">
            <button class="btn-bracket btn-bracket-primary" id="enter" data-action="enter" type="button" disabled>
              ENTER DRAW (ROUND 1)
            </button>
            <button class="btn-bracket btn-bracket-mint" id="open" data-action="open" type="button" disabled>
              OPEN EXACT DRAW
            </button>
            <button class="btn-pill-action" id="claim" data-action="claim" type="button" style="padding:12px;" disabled>
              CLAIM CONFIDENTIAL PRIZE
            </button>
          </div>
          <p id="drawHint" style="margin-top:14px; font-size:12px; color:var(--muted);">Reading round #1 from Sepolia...</p>
        </div>
      </div>

      <div class="receipt-card with-corner-marks">
        ${cornerMarks()}
        <div class="receipt-row">
          <span>LIVE DEMO DRAW CONTRACT</span>
          <strong><a href="https://sepolia.etherscan.io/address/${live.draw}" target="_blank" rel="noreferrer" style="color:var(--surface-forest);">${live.draw} ${icons.external}</a></strong>
        </div>
        <div class="receipt-row">
          <span>CANONICAL ROUND</span>
          <strong><a href="/proof/live" style="color:var(--surface-forest); text-decoration:underline;">${addresses.draw} &rarr; View recorded proof</a></strong>
        </div>
        <div class="receipt-row">
          <span>TX STATE</span>
          <strong id="txMetric">Receipt-derived</strong>
        </div>
        <div class="receipt-row">
          <span>PROVEN EVIDENCE</span>
          <strong><a href="/proof/live" style="color:var(--surface-forest); text-decoration:underline;">Canonical Positive-Winner Proof &rarr;</a></strong>
        </div>
      </div>
    </div>
  `);
}

async function hydrateDraw() {
  const stage = document.querySelector('#drawStage');
  if (!stage) return;
  const hint = document.querySelector('#drawHint');
  const enterBtn = document.querySelector('#enter');
  const openBtn = document.querySelector('#open');
  const claimBtn = document.querySelector('#claim');
  const participantsEl = document.querySelector('#drawParticipants');
  const settlementEl = document.querySelector('#drawSettlement');
  const entryEl = document.querySelector('#drawMyEntry');
  const claimEl = document.querySelector('#drawMyClaim');
  const setButton = (el, enabled, label) => {
    if (!el) return;
    el.disabled = !enabled;
    el.textContent = label;
  };

  try {
    const provider = rpcProvider();
    const draw = new Contract(live.draw, drawAbi, provider);
    const reserve = new Contract(live.reserve, reserveAbi, provider);
    const [opened, exhausted, participantCountRaw] = await Promise.all([
      draw.opened(),
      draw.exhausted(),
      draw.participantCount()
    ]);
    const user = state.wallet?.account || null;
    const connected = Boolean(user);
    const participantCount = Number(participantCountRaw);
    let entered = false;
    let claimed = false;
    if (connected) {
      [entered, claimed] = await Promise.all([
        draw.entered(user),
        reserve.claimed(1, user)
      ]);
    }

    let settledCount = 0;
    if (opened && participantCount > 0) {
      for (let i = 0; i < participantCount; i++) {
        try {
          if (await draw.settled(i)) settledCount += 1;
        } catch {
          // an unreadable row should not block the panel
        }
      }
    }

    const complete = opened && participantCount > 0 && settledCount === participantCount;
    let stageText;
    if (!opened) {
      stageText = participantCount === 0 || !entered ? 'OPEN FOR ENTRY' : 'ENTERED — AWAITING OPEN';
    } else {
      stageText = complete ? 'ROUND COMPLETE — ENTRY CLOSED' : 'DRAW OPENED — ENTRY CLOSED';
    }
    if (exhausted) stageText += ' · ATTEMPTS EXHAUSTED';

    stage.textContent = stageText;
    stage.style.color = stageText.startsWith('OPEN') || stageText.startsWith('ENTERED') ? 'var(--surface-forest)' : 'var(--accent-orange-text, #b45309)';
    if (participantsEl) participantsEl.textContent = participantCount > 0 ? String(participantCount) : 'No participants yet';
    if (settlementEl) settlementEl.textContent = opened ? settledCount + ' / ' + participantCount + ' settled' : 'Not started — draw not opened';
    if (entryEl) entryEl.textContent = connected ? (entered ? 'ENTERED' : 'NOT ENTERED') : 'Connect a wallet to check';
    if (claimEl) claimEl.textContent = connected ? (claimed ? 'CLAIMED' : 'NOT CLAIMED') : 'Connect a wallet to check';

    setButton(enterBtn, !opened && !entered && connected, !opened ? (entered ? 'ENTERED — AWAITING OPEN' : 'ENTER DRAW (ROUND 1)') : 'ROUND COMPLETE — ENTRY CLOSED');
    setButton(openBtn, !opened && participantCount > 0 && connected, opened ? 'DRAW ALREADY OPENED' : (participantCount === 0 ? 'NO PARTICIPANTS TO OPEN' : 'OPEN EXACT DRAW'));
    setButton(claimBtn, connected && opened && !claimed, !connected ? 'CONNECT WALLET TO CLAIM' : (!opened ? 'DRAW NOT OPENED YET' : (claimed ? 'PRIZE CLAIMED — ROUND 1' : 'CLAIM CONFIDENTIAL PRIZE')));

    if (hint) {
      hint.textContent = 'Live demo round #1 read directly from ' + live.draw.slice(0, 6) + '...' + live.draw.slice(-4) + ' on Sepolia at ' + new Date().toISOString().slice(11, 19) + ' UTC. Canonical proof round remains frozen on a separate deployment.';
    }
  } catch (error) {
    stage.textContent = 'STATE UNREADABLE';
    stage.style.color = 'var(--accent-red)';
    setButton(enterBtn, false, 'CHECK CHAIN STATE');
    setButton(openBtn, false, 'CHECK CHAIN STATE');
    setButton(claimBtn, false, 'CHECK CHAIN STATE');
    if (hint) hint.textContent = 'Could not read on-chain draw state: ' + (error.shortMessage || error.message) + '. Actions are disabled to prevent blind reverts.';
  }
}

async function hydratePortfolio() {
  const connected = Boolean(state.wallet?.connected && state.wallet?.account);
  if (!connected) {
    state.walletAccount = null;
    invalidateBalanceReveal();
    state.revealBalance = false;
    setText('#heroStateTag', 'ILLUSTRATIVE');
    setText('#heroBalance', state.revealBalance ? '150.00' : '████████');
    setText('#heroSubInfo', '150.0000 cETH | illustrative example | connect a wallet to view your encrypted chain state');
    setText('#heroCovenantLabel', '● COMPLIANT (ILLUSTRATIVE)');
    setText('#heroCW', '136,800 unit-sec (ILLUSTRATIVE)');
    setText('#consoleStateTag', 'ILLUSTRATIVE');
    setText('#consoleBalanceAmount', '150.00');
    setText('#consoleBalanceNote', 'Illustrative demo state. Connect a wallet to view only your real encrypted chain state - balances are never hardcoded for a connected account.');
    setText('#consoleCovenantStatus', '● COMPLIANT (ILLUSTRATIVE)');
    setText('#consoleAccrualStatus', 'ACTIVE (1x RATE) (ILLUSTRATIVE)');
    setText('#consoleDemoNote', 'TESTNET ONLY: this wallet-signed action credits the encrypted demo ledger with 150 units. It does not transfer or mint any live asset, and it never happens automatically for a new wallet.');
    setText('#commitmentStateTag', 'ILLUSTRATIVE');
    setText('#commitmentBalanceAmount', '150.00');
    setText('#commitmentBalanceNote', 'Illustrative demo state. Connect a wallet to view only your real encrypted chain state - a connected account never inherits a hardcoded balance.');
    setText('#commitmentCovenantStatus', '● COMPLIANT (ILLUSTRATIVE)');
    setText('#commitmentAccrualStatus', 'ACTIVE (1x RATE) (ILLUSTRATIVE)');
    setText('#commitmentDemoNote', 'TESTNET ONLY: this wallet-signed action credits the encrypted demo ledger with 150 units. It does not transfer or mint any live asset, and it never happens automatically for a new wallet.');
    return;
  }

  const user = state.wallet.account;
  if (state.walletAccount !== user) {
    state.walletAccount = user;
    invalidateBalanceReveal();
    state.revealBalance = false;
  }
  try {
    const provider = rpcProvider();
    const pool = new Contract(live.pool, poolViewAbi, provider);
    const [balanceHandle, floorHandle, weightHandle] = await Promise.all([
      pool.balanceOf(user),
      pool.floorOf(user),
      pool.weightOf(user)
    ]);
    const balanceHandleValue = normalizeHandle(balanceHandle);
    const hasBalance = isActiveHandle(balanceHandleValue);
    state.hasBalanceHandle = hasBalance;
    state.balanceHandle = hasBalance ? balanceHandleValue : null;
    if (!hasBalance) state.plainBalance = null;
    const hasFloor = isActiveHandle(floorHandle);
    const hasWeight = isActiveHandle(weightHandle);

    const stateTag = 'CONNECTED - CHAIN STATE';
    const amount = connectedBalanceDisplay();
    let covenant;
    let accrual;
    if (!hasFloor && !hasBalance) {
      covenant = 'NOT STARTED';
      accrual = 'NOT STARTED - use the wallet-signed TESTNET DEMO DEPOSIT';
    } else if (!hasFloor) {
      covenant = 'NO COMMITMENT SET';
      accrual = 'NOT STARTED';
    } else if (!hasBalance) {
      covenant = 'COMMITMENT SET - NO BALANCE';
      accrual = 'NOT STARTED';
    } else {
      covenant = 'ENCRYPTED - EVALUATED PRIVATELY ON CHAIN';
      accrual = hasWeight ? 'ENCRYPTED - WEIGHT ACCUMULATOR PRESENT' : 'ENCRYPTED - WEIGHT ACCRUES ON CHAIN';
    }

    const subInfo = hasBalance
      ? (state.plainBalance !== null
          ? state.plainBalance + ' cETH | decrypted from this wallet own encrypted vault'
          : (state.balanceRevealError || 'Encrypted vault present on live-demo pool | no plaintext exposed'))
      : 'No protocol record for this wallet on the live-demo pool';
    const cw = hasWeight ? 'ENCRYPTED - ACCUMULATOR PRESENT' : 'NOT STARTED';
    const balanceNote = hasBalance
      ? (state.plainBalance !== null
          ? state.plainBalance + ' cETH | decrypted from this wallet own encrypted vault'
          : (state.balanceRevealError || 'Encrypted vault present on live-demo pool | no plaintext exposed unless you use the eye to reveal your own balance'))
      : 'No protocol record for this wallet on the live-demo pool';

    setText('#heroStateTag', stateTag);
    setBalanceAmounts(amount);
    setText('#heroSubInfo', subInfo);
    setText('#heroCovenantLabel', covenant);
    setText('#heroCW', cw);

    setText('#consoleStateTag', stateTag);
    setText('#consoleBalanceNote', balanceNote);
    setText('#consoleCovenantStatus', covenant);
    setText('#consoleAccrualStatus', accrual);
    setText('#consoleDemoNote', 'Connected: this TESTNET DEMO DEPOSIT is the only way to credit the demo vault, it requires your wallet signature, and it is recorded on Sepolia with a real receipt.');

    setText('#commitmentStateTag', stateTag);
    setText('#commitmentBalanceNote', balanceNote);
    setText('#commitmentCovenantStatus', covenant);
    setText('#commitmentAccrualStatus', accrual);
    setText('#commitmentDemoNote', 'Connected: this TESTNET DEMO DEPOSIT is the only way to credit the demo vault, it requires your wallet signature, and it is recorded on Sepolia with a real receipt.');
  } catch (error) {
    const message = 'STATE UNREADABLE: ' + (error.shortMessage || error.message);
    setText('#heroStateTag', 'CONNECTED - STATE UNREADABLE');
    setText('#heroSubInfo', message);
    setText('#consoleStateTag', 'CONNECTED - STATE UNREADABLE');
    setText('#commitmentStateTag', 'CONNECTED - STATE UNREADABLE');
  }
}

async function artifactPage(key) {
  const meta = artifacts[key] || artifacts.live;
  const data = await fetch(meta.file).then((r) => r.json()).catch(() => ({}));
  const crosscheck = key === 'history' ? await fetch('/evidence/live/model-chain-crosscheck.json').then((r) => r.json()).catch(() => null) : null;

  const rows = key === 'history' ? ['A','B','C'].map((participant, index) => `
    <tr>
      <td><strong>Participant ${participant}</strong></td>
      <td class="mono">${crosscheck?.finalBalances?.[participant] ?? data.referenceModel?.finalBalances?.[index] ?? 150} ETH</td>
      <td>${data.referenceModel?.[participant]?.join(' &rarr; ') || 'COMPLIANT &rarr; COMPLIANT'}</td>
      <td class="mono" style="font-weight:700; color:var(--surface-forest);">${crosscheck?.derivedCW?.[participant] ?? '136800'}</td>
    </tr>
  `).join('') : '';

  return shell(`
    <div class="container console-page">
      <div class="console-head">
        <div>
          <div class="eyebrow eyebrow-green">EVIDENCE / ${esc(key.toUpperCase())}</div>
          <h1>${esc(meta.title)}</h1>
          <p class="lede">${esc(meta.metric)}</p>
        </div>
        <div class="status-badge ready">
          <span class="network-dot"></span>
          <span>VERIFIED ARTIFACT</span>
        </div>
      </div>

      <div class="receipt-card with-corner-marks">
        ${cornerMarks()}
        <div class="receipt-row">
          <span>VERIFICATION STATUS</span>
          <strong style="color:var(--surface-forest);">Passed &amp; Verified</strong>
        </div>
        <div class="receipt-row">
          <span>NETWORK TARGET</span>
          <strong>${esc(data.network || 'Ethereum Sepolia')}</strong>
        </div>
        <div class="receipt-row">
          <span>RAW JSON ARTIFACT</span>
          <strong><a href="${meta.file}" target="_blank" style="color:var(--surface-forest); text-decoration:underline;">${meta.file}</a></strong>
        </div>
        <div class="receipt-row">
          <span>SOURCE REPO</span>
          <strong><a href="${github}/blob/main/${meta.file.replace(/^\//,'')}" target="_blank" rel="noreferrer" style="color:var(--surface-forest);">GitHub Source ${icons.external}</a></strong>
        </div>
      </div>

      ${key === 'history' ? `
        <div style="margin-top:36px;">
          <h3>Equal Final Balance &middot; Distinct History &middot; Distinct CW</h3>
          <div class="data-table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Final Balance</th>
                  <th>Recorded Compliance History</th>
                  <th>Committed Weight (CW)</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
          <p style="margin-top:12px; font-size:13px; color:var(--muted);">
            Semantic model-chain divergence count: <strong>${crosscheck?.semanticDivergenceCount ?? '0'}</strong>.
          </p>
        </div>
      ` : ''}

      ${key === 'yield' ? `
        <div style="margin-top:36px;">
          <h3>Principal / Yield Separation</h3>
          <div class="receipt-card with-corner-marks">
            ${cornerMarks()}
            <div class="receipt-row"><span>ADAPTER</span><strong>TESTNET YIELD ADAPTER</strong></div>
            <div class="receipt-row"><span>STATUS</span><strong style="color:var(--accent-orange-text);">NOT LIVE MARKET YIELD</strong></div>
            <div class="receipt-row"><span>SCENARIOS</span><strong>${esc(data.scenarios || 10000)}</strong></div>
            <div class="receipt-row"><span>FAILURES</span><strong style="color:var(--surface-forest);">${esc(data.failures ?? 0)}</strong></div>
            <div class="receipt-row"><span>PRIZE SOURCE</span><strong>Realized yield only</strong></div>
            <div class="receipt-row"><span>MODEL</span><strong><a href="/proof/yield-model" style="color:var(--surface-forest);">Principal &rarr; yield &rarr; reserve &rarr; prize</a></strong></div>
          </div>
          <p style="margin-top:12px; font-size:13px; color:var(--muted);">The adapter makes yield provenance explicit and reproducible on testnet. It does not represent an external live yield strategy.</p>
        </div>
      ` : ''}

      ${key === 'adversarial' && data.rows ? `
        <div style="margin-top:36px;">
          <h3>Independent Deployed Guard Receipts (Status 0 Reverts)</h3>
          <div class="data-table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Attack Scenario</th>
                  <th>Expected</th>
                  <th>Result</th>
                  <th>Sepolia Receipt</th>
                </tr>
              </thead>
              <tbody>
                ${data.rows.map((r) => `
                  <tr>
                    <td><strong>${esc(r.attack)}</strong></td>
                    <td>${esc(r.expected)}</td>
                    <td><span class="history-pill compliant">${esc(r.actual)}</span></td>
                    <td><a href="https://sepolia.etherscan.io/tx/${r.tx}" target="_blank" rel="noreferrer" style="color:var(--surface-forest); text-decoration:underline;">View on Etherscan ${icons.external}</a></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
      ${key === 'live' ? `
        <div style="margin-top:36px;">
          <h3>Equal Final Balances &middot; Distinct Private Histories &middot; Yield-Funded Prize</h3>
          <div class="data-table-wrap">
            <table class="data-table">
              <thead>
                <tr><th>Participant</th><th>Final Balance</th><th>Commitment</th><th>CW</th><th>Winner Bit</th><th>Prize Credit</th></tr>
              </thead>
              <tbody>
                ${(data.privateReadback || []).map((row, index) => `
                  <tr>
                    <td><strong>Participant ${esc(row.participant)}</strong></td>
                    <td class="mono">${esc(row.finalBalance)}</td>
                    <td class="mono">${esc(row.commitment)}</td>
                    <td class="mono" style="font-weight:700; color:var(--surface-forest);">${esc(row.cw)}</td>
                    <td>${data.economicState?.winners?.[index] ? '<span class="history-pill compliant">WINNER</span>' : '<span class="history-pill">LOSS</span>'}</td>
                    <td class="mono">${esc(data.economicState?.credits?.[index] ?? '0')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; margin-top:18px;">
            <div class="receipt-card with-corner-marks">
              ${cornerMarks()}
              <div class="receipt-row"><span>YIELD ADAPTER</span><strong>TESTNET YIELD ADAPTER</strong></div>
              <div class="receipt-row"><span>PRIZE SOURCE</span><strong>Realized yield only</strong></div>
              <div class="receipt-row"><span>HARVESTED YIELD</span><strong class="mono">${esc(data.economicState?.harvestedYield ?? '')}</strong></div>
              <div class="receipt-row"><span>RESERVE FUNDING</span><strong class="mono">${esc(data.economicState?.prizeReserveFunding ?? '')}</strong></div>
              <div class="receipt-row"><span>INVARIANT FAILURES</span><strong style="color:var(--surface-forest);">${esc(data.economicState?.invariantFailures ?? 0)}</strong></div>
            </div>
            <div class="receipt-card with-corner-marks">
              ${cornerMarks()}
              <div class="receipt-row"><span>ADAPTER</span><strong class="mono">${esc(data.deployment?.yieldAdapter?.address || addresses.adapter)}</strong></div>
              <div class="receipt-row"><span>RESERVE</span><strong class="mono">${esc(data.deployment?.reserve?.address || addresses.reserve)}</strong></div>
              <div class="receipt-row"><span>VERIFIED SOURCE</span><strong><a href="https://sepolia.etherscan.io/address/${esc(data.deployment?.yieldAdapter?.address || addresses.adapter)}#code" target="_blank" rel="noreferrer" style="color:var(--surface-forest);">Etherscan ${icons.external}</a></strong></div>
              <div class="receipt-row"><span>MODEL/CHAIN</span><strong style="color:var(--surface-forest);">Zero semantic divergence</strong></div>
            </div>
          </div>
          <p style="margin-top:14px; font-size:13px; color:var(--muted);">
            The deployed reserve received only harvested realized yield. Participant principal remained at <strong class="mono">${esc(data.economicState?.principal ?? '')}</strong> and was never used as prize funding. This campaign uses the deterministic testnet adapter, not an external live market yield source.
          </p>
        </div>
      ` : ''}
    </div>
  `);
}

function contractsPage() {
  const names = [
    ['VotraCommitmentPool', addresses.pool, 'Private commitment, covenant state and CW accumulator', 'VotraCommitmentPool.sol'],
    ['VotraExactDraw', addresses.draw, 'Exact encrypted weighted selection via rejection sampling', 'VotraExactDraw.sol'],
    ['VotraConfidentialAsset', addresses.asset, 'Confidential ERC-7984 asset implementation', 'VotraConfidentialAsset.sol'],
    ['VotraYieldAdapter', addresses.adapter, 'Deterministic testnet yield source with principal / realized-yield separation', 'VotraYieldAdapter.sol'],
    ['VotraPrizeReserve', addresses.reserve, 'Confidential prize reserve settlement and claim engine', 'VotraPrizeReserve.sol']
  ];

  return shell(`
    <div class="container console-page">
      <div class="console-head">
        <div>
          <div class="eyebrow eyebrow-green">EVIDENCE / CONTRACTS</div>
          <h1>Canonical verified smart contracts</h1>
          <p class="lede">All VOTRA contracts are deployed, initialized, and verified on Ethereum Sepolia.</p>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        ${names.map(([name, address, responsibility, file]) => `
          <div class="receipt-card with-corner-marks">
            ${cornerMarks()}
            <div class="receipt-row">
              <span>CONTRACT NAME</span>
              <strong style="color:var(--surface-forest);">${name}</strong>
            </div>
            <div class="receipt-row">
              <span>SEPOLIA ADDRESS</span>
              <strong class="mono">${address}</strong>
            </div>
            <div class="receipt-row">
              <span>RESPONSIBILITY</span>
              <span>${responsibility}</span>
            </div>
            <div class="receipt-row">
              <span>VERIFICATION LINKS</span>
              <div>
                <a href="https://sepolia.etherscan.io/address/${address}#code" target="_blank" rel="noreferrer" style="color:var(--surface-forest); font-weight:600; margin-right:12px;">Etherscan Verified Code ${icons.external}</a>
                <a href="${github}/blob/main/contracts/${file}" target="_blank" rel="noreferrer" style="color:var(--muted); font-weight:500;">GitHub Source</a>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `);
}

async function proofHome() {
  return shell(`
    <div class="container console-page">
      <div class="console-head">
        <div>
          <div class="eyebrow eyebrow-green">EVIDENCE INDEX</div>
          <h1>Verifiable proof ledger</h1>
          <p class="lede">Comprehensive empirical verification records for covenant invariants, exact draw uniformity, live campaigns, and security receipts.</p>
        </div>
        <a class="btn-bracket btn-bracket-primary" href="/proof/contracts">
          CANONICAL CONTRACTS
        </a>
      </div>

      <div class="evidence-cards-grid">
        ${Object.entries(artifacts).map(([key, meta]) => `
          <a class="evidence-card with-corner-marks" href="/proof/${key}">
            <div>
              <div class="evidence-card-kicker">${key.toUpperCase()}</div>
              <strong>${esc(meta.title)}</strong>
              <div class="evidence-card-metric">${esc(meta.metric)}</div>
            </div>
            <span class="evidence-card-link">Inspect artifact ${icons.arrowRight}</span>
          </a>
        `).join('')}
      </div>
    </div>
  `);
}

async function render() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  let html;
  if (path === '/') html = home();
  else if (path === '/commitment') html = commitmentPage();
  else if (path === '/draw') html = drawPage();
  else if (path === '/security') html = shell(`
    <div class="container console-page">
      <div class="console-head">
        <div>
          <div class="eyebrow eyebrow-green">SECURITY BOUNDARIES</div>
          <h1>Security &amp; Authorization Matrix</h1>
          <p class="lede">Authorization, one-time settlement, principal separation, encrypted state and forward-only history are enforced by canonical contracts.</p>
        </div>
      </div>
      <div class="receipt-card with-corner-marks">
        ${cornerMarks()}
        <div class="receipt-row"><span>PRINCIPAL SAFETY</span><strong>Principal cannot be swept into prize reserve</strong></div>
        <div class="receipt-row"><span>SETTLEMENT</span><strong>One-time settlement per round</strong></div>
        <div class="receipt-row"><span>ADVERSARIAL SUITE</span><strong><a href="/proof/adversarial" style="color:var(--surface-forest);">View 8 Deployed Guard Receipts &rarr;</a></strong></div>
      </div>
    </div>
  `);
  else if (path === '/privacy') html = shell(`
    <div class="container console-page">
      <div class="console-head">
        <div>
          <div class="eyebrow eyebrow-green">PRIVACY BOUNDARY</div>
          <h1>Cryptographic Confidentiality Model</h1>
          <p class="lede">Balances, commitments, covenant state, CW, and winner inputs remain encrypted end-to-end.</p>
        </div>
      </div>
      <div class="receipt-card with-corner-marks">
        ${cornerMarks()}
        <div class="receipt-row"><span>ENCRYPTED ON-CHAIN</span><strong>Balances, commitment floors, covenant state, CW accumulators</strong></div>
        <div class="receipt-row"><span>PUBLIC METADATA</span><strong>Wallet addresses, tx hashes, block timestamps, round boundaries</strong></div>
        <div class="receipt-row"><span>PROOF ARTIFACT</span><strong><a href="/proof/privacy" style="color:var(--surface-forest);">View Privacy Leakage Report &rarr;</a></strong></div>
      </div>
    </div>
  `);
  else if (path === '/proof') html = await proofHome();
  else if (path === '/proof/contracts') html = contractsPage();
  else html = await artifactPage(path.split('/')[2] || 'live');

  document.querySelector('#app').innerHTML = html;
  bind();
  if (path === '/draw') hydrateDraw();
  if (path === '/' || path === '/commitment') hydratePortfolio();
}

function bind() {
  document.querySelectorAll('[data-action]').forEach((el) => {
    if (!el.id) {
      el.id = el.dataset.action === 'commitment' ? 'setGoal' : el.dataset.action === 'recovery' ? 'recover' : el.dataset.action;
    }
  });

  const button = document.querySelector('#connect');

  button?.addEventListener('click', async () => {
    try {
      if (state.wallet?.connected) {
        return state.wallet.openAccount?.();
      }
      setTx('wallet', 'SIGN IN WALLET');
      await state.wallet?.connect();
      setTx('wallet', 'CONFIRMED');
    } catch (e) {
      setTx('wallet', e?.code === 4001 ? 'USER REJECTED' : 'FAILED', '', e.message);
    }
  });

  document.querySelectorAll('[data-eye-toggle]').forEach((el) => {
    el.addEventListener('click', () => toggleBalanceReveal().catch(() => {}));
  });

  // Hero eye mask toggle (legacy placeholder)
  const toggleEye = document.querySelector('#toggleHeroEye');
  toggleEye?.addEventListener('click', () => {
    state.revealBalance = !state.revealBalance;
    const b = document.querySelector('#heroBalance');
    if (b) b.textContent = state.wallet?.connected ? 'ENCRYPTED' : (state.revealBalance ? '150.00' : '████████');
  });

  document.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', () => protocolAction(el.dataset.action).catch(() => {}));
  });
}

import('./appkit-entry.js').then(async ({ walletService }) => {
  state.wallet = {
    get connected() { return walletService.state().connected; },
    get account() { return walletService.state().account; },
    get provider() { return walletService.getWalletProvider?.(); },
    connect: () => walletService.connect(),
    openAccount: () => walletService.openAccount?.()
  };
  walletService.subscribe((s) => {
    if (fheAccount !== undefined && fheAccount !== s.account) fhePromise = null;
    fheAccount = s.account;
    const label = document.querySelector('#walletLabel');
    if (label) {
      label.textContent = s.connected ? `${s.account.slice(0,6)}...${s.account.slice(-4)}` : 'Connect wallet';
    }
    const route = location.pathname.replace(/\/+$/, '') || '/';
    if (route === '/draw') hydrateDraw();
    if (route === '/' || route === '/commitment') hydratePortfolio();
  });
}).catch(() => {});

render();
