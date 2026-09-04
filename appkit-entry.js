import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { sepolia } from '@reown/appkit/networks';

const projectId = __REOWN_PROJECT_ID__;
const metadata = {
  name: 'VOTRA',
  description: 'Private commitment. Fair chance.',
  url: window.location.origin,
  icons: [`${window.location.origin}/favicon.ico`]
};
const appkit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [sepolia],
  projectId,
  metadata,
  features: { analytics: false }
});

class AppKitWalletService {
  constructor() {
    this.listeners = new Set();
    this.unsubscribe = appkit.subscribeState(() => this.emit());
    this.emit();
  }
  state() {
    const address = appkit.getAddress('eip155');
    const chain = appkit.getState()?.selectedNetworkId;
    return {
      connected: Boolean(address),
      account: address || null,
      chainId: chain ? `0x${Number(chain).toString(16)}` : null,
      correctNetwork: Number(chain) === 11155111,
      status: address ? (Number(chain) === 11155111 ? 'connected' : 'wrong-network') : 'anonymous'
    };
  }
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state());
    return () => this.listeners.delete(listener);
  }
  emit() {
    const state = this.state();
    this.listeners.forEach((listener) => listener(state));
  }
  async connect() {
    await appkit.open();
    return this.state();
  }
  async requestSepolia() {
    await appkit.switchNetwork(sepolia);
    return this.state();
  }
  async disconnect() {
    await appkit.disconnect();
    this.emit();
  }
}

export const walletService = new AppKitWalletService();
const button = document.getElementById('connect');
walletService.subscribe((wallet) => {
  if (!button) return;
  button.textContent = wallet.status === 'connected'
    ? `${wallet.account.slice(0, 6)}...${wallet.account.slice(-4)}`
    : wallet.status === 'wrong-network' ? 'Switch to Sepolia' : 'Connect wallet';
});
button?.addEventListener('click', async () => {
  try {
    if (walletService.state().status === 'wrong-network') await walletService.requestSepolia();
    else if (walletService.state().status === 'connected') await appkit.open({ view: 'Account' });
    else await walletService.connect();
  } catch (error) {
    const status = document.getElementById('statusText');
    if (status) status.textContent = error.message;
  }
});
