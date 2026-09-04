const assert=require('node:assert/strict'); const {VotraModel}=require('../packages/reference-model');
const checks=[]; const check=(name,fn)=>{fn();checks.push(name);};
check('forward-only breach and immediate recovery',()=>{const m=new VotraModel();m.setCommitment(100);m.deposit(120,1);m.accrue(11);assert.equal(m.weight,1200);m.withdraw(30,12);m.accrue(22);assert.equal(m.weight,1320);m.deposit(30,23);m.accrue(24);assert.equal(m.weight,1440);});
check('principal conservation',()=>{const m=new VotraModel();m.setCommitment(10);m.deposit(50,1);m.withdraw(20,2);assert.equal(m.balance,30);assert.equal(m.principal,30);});
check('commitment freeze',()=>{const m=new VotraModel();m.setCommitment(10);assert.throws(()=>m.setCommitment(1),/frozen/);});
check('weighted selection bounded',()=>{const i=VotraModel.select([1,3,6],7);assert.equal(i,2);assert.ok(i>=0&&i<3);});
check('breach recovery does not repair history',()=>{const m=new VotraModel();m.setCommitment(100);m.deposit(100,1);m.accrue(11);const before=m.weight;m.withdraw(1,12);m.deposit(1,13);m.accrue(14);assert.equal(m.weight,before+200);assert.equal(m.cycles,1);});
check('over-withdraw and time regression rejected',()=>{const m=new VotraModel();m.setCommitment(1);m.deposit(2,1);assert.throws(()=>m.withdraw(3,2),/invalid withdrawal/);assert.throws(()=>m.accrue(-1),/time regression/);});
console.log(`PASS ${checks.length} VOTRA checks`);
