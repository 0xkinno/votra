# Architecture

```mermaid
flowchart LR
  U[Saver wallet] --> P[VotraCommitmentPool]
  U --> A[VotraConfidentialAsset]
  P --> D[VotraExactDraw]
  Y[VotraYieldAdapter] --> R[VotraPrizeReserve]
  R --> D
  D --> W[Private winner / prize claim]
  P --> E[Encrypted proof receipt and evidence]
```

`VotraCommitmentPool` owns the encrypted balance, commitment floor, covenant state and CW accumulator. `VotraConfidentialAsset` is the ERC-7984 confidential balance and transfer layer. `VotraExactDraw` sums encrypted commitment weights and performs bounded exact rejection sampling over `[0, maxTotalWeight)`. `VotraYieldAdapter` keeps principal separate from realized yield and is the only path that funds the prize reserve. `VotraPrizeReserve` receives realized yield and settles the encrypted winner without touching participant principal.

The canonical stack deployed on Sepolia is Pool, ExactDraw, ConfidentialAsset, YieldAdapter, and PrizeReserve. The adapter is explicitly a **TESTNET YIELD ADAPTER / NOT LIVE MARKET YIELD**; no external market strategy is claimed.
