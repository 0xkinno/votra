const SEPOLIA_CHAIN_ID = '0xaa36a7';
class WalletService {
  constructor(){this.provider=null;this.account=null;this.chainId=null;this.listeners=new Set()}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  state(){return{connected:Boolean(this.account),account:this.account,chainId:this.chainId,correctNetwork:this.chainId===SEPOLIA_CHAIN_ID,status:this.account?(this.chainId===SEPOLIA_CHAIN_ID?'connected':'wrong-network'):'anonymous'}}
  emit(){const s=this.state();this.listeners.forEach(fn=>fn(s))}
  async connect(){this.provider=window.ethereum;if(!this.provider)throw Error('No injected wallet detected.');const a=await this.provider.request({method:'eth_requestAccounts'});this.account=a[0]||null;this.chainId=await this.provider.request({method:'eth_chainId'});this.provider.on?.('accountsChanged',x=>{this.account=x[0]||null;this.emit()});this.provider.on?.('chainChanged',x=>{this.chainId=x;this.emit()});this.emit();return this.state()}
  async requestSepolia(){if(!this.provider)await this.connect();try{await this.provider.request({method:'wallet_switchEthereumChain',params:[{chainId:SEPOLIA_CHAIN_ID}]})}catch(e){if(e.code!==4902)throw e;await this.provider.request({method:'wallet_addEthereumChain',params:[{chainId:SEPOLIA_CHAIN_ID,chainName:'Sepolia',nativeCurrency:{name:'Sepolia Ether',symbol:'ETH',decimals:18},rpcUrls:['https://rpc.sepolia.org'],blockExplorerUrls:['https://sepolia.etherscan.io']}]})}}
  async disconnect(){this.account=null;this.chainId=null;this.emit()}
  async sendTransaction(tx){if(!this.provider||!this.account)throw Error('Connect a wallet first.');if(this.chainId!==SEPOLIA_CHAIN_ID)throw Error('Switch to Sepolia before signing.');return this.provider.request({method:'eth_sendTransaction',params:[{from:this.account,...tx}]})}
}
window.walletService=new WalletService();
