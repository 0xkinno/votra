# Security Model

| Threat | Expected result | Test |
|---|---|---|
| Malicious participant withdraws below floor | Future accrual is zero; prior weight remains | `tests/adversarial/recovery.test.js` |
| Mid-round commitment change | Rejected | commitment freeze test |
| Replayed draw or input | Rejected by round nonce / consumed marker | draw replay test |
| Unauthorized decryption | Refused by ACL boundary | proof probes |
| Reserve shortfall | Settlement halts without touching principal | reserve test |
| Yield adapter principal theft | Adapter never exposes a reserve withdrawal path; owner can only withdraw adapter principal | `test/VotraYieldAdapter.js` |
| Harvest redirect | Harvest destination is immutable at deployment; realized yield is the only reserve funding source | `VotraYieldAdapter` constructor + campaign invariant |
| Timestamp edge / same-block mutations | Deterministic single accrual | boundary tests |
| Reentrancy / callback | No external callback before accounting is committed | contract review |

This is not an anonymity system. Wallet identity, transaction timing, gas, and participation metadata may remain observable.

Participant principal and realized testnet yield remain separate accounting quantities in `VotraYieldAdapter`. The live canonical campaign preserves `450` principal while `1000` harvested realized yield funds the reserve; evidence is in `evidence/live/canonical-yield-campaign.json` and `evidence/release/yield-gate.json`.

Full principal withdrawal is live-proven on a fresh identical disposable demo
deployment: `150 deposited = 0 remaining + 150 withdrawn`
(`evidence/live/withdrawal-proof.json`,
`evidence/yield/principal-conservation-live.json`). Saver principal exits through
`VotraCommitmentPool.withdraw` at any time and never funds the prize.
