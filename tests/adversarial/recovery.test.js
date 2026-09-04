const test=require('node:test'); const assert=require('node:assert/strict'); const {VotraModel}=require('../../packages/reference-model');
test('repeated breach/recovery never repairs history',()=>{const m=new VotraModel();m.setCommitment(100);m.deposit(100,1);m.accrue(11);const before=m.weight;m.withdraw(1,12);m.deposit(1,13);m.accrue(14);assert.equal(m.weight,before+200);assert.equal(m.cycles,1);});
test('over-withdrawal rejected',()=>{const m=new VotraModel();m.setCommitment(1);m.deposit(2,1);assert.throws(()=>m.withdraw(3,2),/invalid withdrawal/);});
test('time cannot move backwards',()=>{const m=new VotraModel();m.setCommitment(1);assert.throws(()=>m.accrue(-1),/time regression/);});
