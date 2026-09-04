# Security Model

| Threat | Expected result | Test |
|---|---|---|
| Malicious participant withdraws below floor | Future accrual is zero; prior weight remains | `tests/adversarial/recovery.test.js` |
| Mid-round commitment change | Rejected | commitment freeze test |
| Replayed draw or input | Rejected by round nonce / consumed marker | draw replay test |
| Unauthorized decryption | Refused by ACL boundary | proof probes |
| Reserve shortfall | Settlement halts without touching principal | reserve test |
| Timestamp edge / same-block mutations | Deterministic single accrual | boundary tests |
| Reentrancy / callback | No external callback before accounting is committed | contract review |

This is not an anonymity system. Wallet identity, transaction timing, gas, and participation metadata may remain observable.
