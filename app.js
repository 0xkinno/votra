class InjectedWalletFallback {
  constructor() {
    this.provider = null;
    this.account = null;
    this.chainId = null;
    this.listeners = new Set();
  }
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state());
    return () => this.listeners.delete(listener);
  }
  state() {
    const connected = Boolean(this.account);
    const correctNetwork = this.chainId === '0xaa36a7';
    return {
      connected,
      account: this.account,
      chainId: this.chainId,
      correctNetwork,
      status: connected ? (correctNetwork ? 'connected' : 'wrong-network') : 'anonymous'
    };
  }
  emit() {
    const state = this.state();
    this.listeners.forEach((listener) => listener(state));
  }
  async connect() {
    this.provider = window.ethereum;
    if (!this.provider) throw Error('Reown is unavailable and no injected wallet was detected.');
    const accounts = await this.provider.request({ method: 'eth_requestAccounts' });
    this.account = accounts[0] || null;
    this.chainId = await this.provider.request({ method: 'eth_chainId' });
    this.provider.on?.('accountsChanged', (next) => { this.account = next[0] || null; this.emit(); });
    this.provider.on?.('chainChanged', (next) => { this.chainId = next; this.emit(); });
    this.emit();
    return this.state();
  }
  async requestSepolia() {
    if (!this.provider) await this.connect();
    await this.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
  }
  async disconnect() {
    this.account = null;
    this.chainId = null;
    this.emit();
  }
}

let walletService = new InjectedWalletFallback();
let appkitReady = false;
const state = { goal: null, balance: 0, weight: 0, breached: false, wallet: null };
const byId = (id) => document.getElementById(id);

function render() {
  byId('statusText').textContent = state.goal === null
    ? 'Ready to set a private floor'
    : state.breached ? 'Below private floor / weight paused' : 'Compliant / weight accumulating';
  byId('timelineState').textContent = state.goal === null
    ? 'Awaiting commitment'
    : state.breached ? 'Breach recorded privately' : 'Compliant segment active';
  byId('maskedBalance').textContent = '******';
  byId('weight').textContent = '******';
  byId('privacy').textContent = state.goal === null ? 'SEALED' : state.breached ? 'PAUSED' : 'SEALED';
  byId('fill').style.width = state.goal === null ? '0%' : state.breached ? '52%' : '78%';
  byId('breachMarker').style.display = state.breached ? 'block' : 'none';
  byId('receiptBreach').textContent = state.breached ? 'compliant -> non-compliant (encrypted)' : 'not observed';
}

byId('setGoal').onclick = () => {
  state.goal = Number(byId('goal').value) || 1000;
  state.balance = state.goal;
  state.weight = state.goal * 7;
  render();
};
byId('deposit').onclick = () => {
  if (state.goal === null) return;
  state.balance += 250;
  state.weight += state.balance * 2;
  state.breached = false;
  render();
};
byId('breach').onclick = () => {
  if (state.goal === null) return;
  state.balance = Math.max(1, state.goal - 1);
  state.breached = true;
  render();
};
byId('recover').onclick = () => {
  if (state.goal === null) return;
  state.balance = state.goal;
  state.breached = false;
  state.weight += state.balance * 2;
  render();
};
byId('start').onclick = () => document.querySelector('#how').scrollIntoView({ behavior: 'smooth' });

const bindWallet = (service) => service.subscribe((wallet) => {
  state.wallet = wallet;
  const button = byId('connect');
  if (wallet.status === 'connected') button.textContent = `${wallet.account.slice(0, 6)}...${wallet.account.slice(-4)}`;
  else if (wallet.status === 'wrong-network') button.textContent = 'Switch to Sepolia';
  else button.textContent = 'Connect wallet';
});

bindWallet(walletService);
import('./appkit-entry.js')
  .then((module) => {
    walletService = module.walletService;
    appkitReady = true;
    bindWallet(walletService);
  })
  .catch(() => {
    appkitReady = false;
  });

byId('connect').onclick = async () => {
  if (appkitReady) return;
  try {
    if (state.wallet?.status === 'wrong-network') await walletService.requestSepolia();
    else if (state.wallet?.status === 'connected') await walletService.disconnect();
    else await walletService.connect();
  } catch (error) {
    byId('statusText').textContent = error.message;
  }
};

render();
