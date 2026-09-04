# Benchmarks

## Mock FHEVM

| Operation | Global HCU | Max depth HCU |
|---|---:|---:|
| `setCommitment` | 152,128 | 152,032 |

These are measured against the local FHEVM mock, not live coprocessor performance. The encrypted regression passes 2/2 tests.

## Plaintext Campaign

The deterministic fairness campaign runs 10,000 mixed-weight scenarios with zero selection-range mismatches and zero invariant failures. Artifact: `evidence/fairness/reference-campaign.json`.

## Live / Deployed

Sepolia deployment and bytecode readback are recorded under `evidence/deployments/`. Production HCU, gas, relayer latency, and funded confidential draw settlement require a live relayer session and are not fabricated here.
