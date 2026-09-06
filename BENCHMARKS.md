# Benchmarks

## Mock FHEVM

| Operation | Global HCU | Max depth HCU |
|---|---:|---:|
| `setCommitment` | 152,128 | 152,032 |

These are measured against the local FHEVM mock, not live coprocessor performance. The encrypted regression passes 2/2 tests.

## Plaintext Campaign

The deterministic fairness campaign runs 10,000 mixed-weight scenarios with zero selection-range mismatches and zero invariant failures. Artifact: `evidence/fairness/reference-campaign.json`.

## Live / Deployed

The canonical yield campaign is live on Sepolia. Per-operation gas is captured
from mined receipts in `evidence/live/canonical-yield-campaign.json`:

| Operation | Live Sepolia gas |
|---|---:|
| `setCommitment` | ~578,541 |
| `deposit` | ~660,213 |
| `withdraw` (breach) | ~679,654 |
| `withdraw` (full principal, live demo) | 344,227 |
| `depositPrincipal` | ~45,214 |
| `accrueYield` | ~45,118 |
| `harvestYield` | ~1,033,172 |
| `winnerBit` | captured in campaign receipts |
| `settleParticipant` / `claim` | captured in campaign receipts |

Local FHEVM HCU remains a mock measurement and is never presented as live HCU.
Deployment manifests, bytecode hashes, and source verification are recorded
under `evidence/deployments/votra-yield-canonical.json`,
`evidence/live/final-yield-deployment.json`, and
`evidence/live/canonical-yield-verification.json`.
The full-principal `withdraw` gas is the mined receipt from
`evidence/live/withdrawal-proof.json` (fresh disposable demo deployment, identical
contract semantics; `150 deposited = 0 remaining + 150 withdrawn`).
