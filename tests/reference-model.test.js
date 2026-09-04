const test=require('node:test'); const assert=require('node:assert/strict'); const {VotraModel}=require('../packages/reference-model');
test('forward-only breach and immediate recovery',()=>{const m=new VotraModel();m.setCommitment(100);m.deposit(120,1);m.accrue(11);assert.equal(m.weight,1200);m.withdraw(30,12);m.accrue(22);assert.equal(m.weight,1320);m.deposit(30,23);m.accrue(24);assert.equal(m.weight,1440);});
test('principal conservation',()=>{const m=new VotraModel();m.setCommitment(10);m.deposit(50,1);m.withdraw(20,2);assert.equal(m.balance,30);assert.equal(m.principal,30);});
test('commitment cannot change mid-round',()=>{const m=new VotraModel();m.setCommitment(10);assert.throws(()=>m.setCommitment(1),/frozen/);});
test('weighted selection is bounded and deterministic',()=>{const i=VotraModel.select([1,3,6],7);assert.equal(i,2);assert.ok(i>=0&&i<3);});
