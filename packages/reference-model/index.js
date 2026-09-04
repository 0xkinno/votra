class VotraModel {
  constructor({ now = 0, round = 1 } = {}) { this.now=now; this.round=round; this.balance=0; this.floor=null; this.weight=0; this.last=now; this.compliant=false; this.principal=0; this.cycles=0; }
  setCommitment(floor) { if (this.floor !== null) throw new Error('commitment frozen for round'); if (!Number.isSafeInteger(floor)||floor<0) throw new Error('invalid floor'); this.floor=floor; this.compliant=this.balance>=floor; }
  accrue(to) { if(to<this.last) throw new Error('time regression'); const dt=to-this.last; if(this.compliant) this.weight+=this.balance*dt; this.last=to; }
  deposit(amount,to=this.now) { this.accrue(to); if(!Number.isSafeInteger(amount)||amount<=0) throw new Error('invalid deposit'); this.balance+=amount; this.principal+=amount; this.compliant=this.floor!==null&&this.balance>=this.floor; this.now=to; }
  withdraw(amount,to=this.now) { this.accrue(to); if(!Number.isSafeInteger(amount)||amount<=0||amount>this.balance) throw new Error('invalid withdrawal'); this.balance-=amount; this.principal-=amount; const next=this.floor!==null&&this.balance>=this.floor; if(this.compliant&&!next)this.cycles+=1; this.compliant=next; this.now=to; }
  closeRound(to=this.now) { this.accrue(to); const result={round:this.round,weight:this.weight,principal:this.principal,cycles:this.cycles}; this.round+=1; this.floor=null; this.weight=0; this.cycles=0; this.last=to; this.now=to; return result; }
  static select(weights,random) { const total=weights.reduce((a,b)=>a+b,0); if(!total)throw new Error('zero total weight'); const boundary=2**Math.ceil(Math.log2(total)); let r=random%boundary; while(r>=total)r=(r*1103515245+12345)%boundary; let cursor=0; for(let i=0;i<weights.length;i++){cursor+=weights[i];if(r<cursor)return i;} throw new Error('selection failure'); }
}
module.exports={VotraModel};
