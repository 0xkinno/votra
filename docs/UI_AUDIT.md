# VOTRA Frontend Audit & Interface Specification

## 1. Executive Summary
This document records the architectural and interface audit of the existing VOTRA frontend codebase prior to the visual and product experience redesign. The protocol logic, smart contract interfaces, FHE encryption flows, Relayer SDK bindings, and evidence artifact references are cataloged to ensure zero regression in business logic.

## 2. Existing Routes & Views
- **`/` (Landing & Overview)**:
  - Header with clickable VOTRA brand mark, navigation capsules, network indicator, and wallet connection button.
  - Hero section with value proposition ("Keep your private commitment. Keep your winning weight."), CTAs, live Sepolia protocol status signal, and interactive protocol card with encrypted balance/covenant simulation.
  - Signature VOTRA mechanism section: "A balance can be private. A promise can be private too." featuring participant comparison (Same Final Balance, Different Private History, Different CW).
  - Covenant timeline interactive visualization: Compliant -> Weight Accrues, Breach -> Future Accrual Pauses, Recovery -> New Accrual Begins.
  - Exact encrypted draw visualization: Encrypted CW -> Encrypted Total Weight -> Random Sample -> Uniform Selection.
  - Live protocol metrics and proof signal section.
- **`/commitment` (Your Commitment / Private Covenant Controls)**:
  - Interactive console for setting private commitment floor, depositing, withdrawing (breach simulation), and recovering.
  - Direct binding to `VotraCommitmentPool.sol` (`setCommitment`, `deposit`, `withdraw`).
  - Real-time transaction state banner (`READY`, `SIGN IN WALLET`, `SUBMITTING`, `PENDING`, `CONFIRMING`, `CONFIRMED`, `USER REJECTED`, `FAILED`).
  - Receipt derivation panels with Etherscan verification links.
- **`/draw` (Exact Encrypted Draw)**:
  - Interactive console for entering rounds, triggering `VotraExactDraw.sol` (`enter`, `open`, `settleParticipant`), and claiming prizes via `VotraPrizeReserve.sol` (`claim`).
  - Canonical draw state metrics, privacy status indicators, and proof verification links.
- **`/proof` (Evidence & Verifiability Index)**:
  - High-level evidence dashboard indexing 8 core empirical artifacts:
    1. `fairness`: Exact selection fairness (`/evidence/fairness/exact-selection-50k.json`)
    2. `history`: History-sensitive campaign (`/evidence/history-sensitivity/live-campaign.json`)
    3. `adversarial`: Deployed adversarial receipts (`/evidence/adversarial/executable-receipts.json`)
    4. `live`: Canonical yield-funded live campaign (`/evidence/live/canonical-yield-campaign.json`)
    5. `discovery`: Discovery transition model (`/evidence/model/canonical-state-transition.json`)
    6. `invariants`: Forward-only invariant tests (`/evidence/invariants/forward-only-randomized.json`)
    7. `privacy`: Privacy leakage analysis (`/evidence/privacy/leakage-campaign.json`)
    8. `benchmarks`: Operation costs & gas/HCU metrics (`/evidence/benchmarks/final-cost-summary.json`)
- **`/proof/contracts`**: Canonical deployed & verified contract addresses (`VotraCommitmentPool`, `VotraExactDraw`, `VotraConfidentialAsset`, `VotraYieldAdapter`, `VotraPrizeReserve`) on Ethereum Sepolia with direct Etherscan and GitHub links.
- **`/proof/:key`**: Dynamic rendered views of specific verification artifacts (including tabular historical CW tables, model-chain cross-checks, and mined status-0 adversarial guard receipts).
- **`/security`**: Canonical security boundary specification and deployed attack receipt links.
- **`/privacy`**: Cryptographic privacy boundary specification separating encrypted on-chain state from public chain metadata.

## 3. Wallet Integration Hooks
- **Reown AppKit Integration** (`appkit-entry.js`):
  - Initialized with `createAppKit`, `EthersAdapter`, and `sepolia` chain.
  - Exposes `AppKitWalletService` with reactive state subscription (`connected`, `account`, `chainId`, `correctNetwork`, `status`).
  - Methods: `connect()`, `openAccount()`, `requestSepolia()`, `disconnect()`, `getWalletProvider()`.
- **Injected Fallback Service** (`wallet-service.js`):
  - Injected `window.ethereum` fallback service managing account and chain change events.
- **Wallet UI State Cycle**:
  - `READY` -> `SIGN IN WALLET` -> `SUBMITTING` -> `PENDING` (with TX hash) -> `CONFIRMING` -> `CONFIRMED` (with Etherscan link) / `USER REJECTED` / `FAILED` (with precise error message).

## 4. Contract Interaction & ABIs
- **`VotraCommitmentPool`** (`0x2E47C272baaEfb584593d61d8Aee6E81CDF1463c`):
  - `setCommitment(bytes32 handle, bytes proof)`
  - `deposit(bytes32 handle, bytes proof)`
  - `withdraw(bytes32 handle, bytes proof)`
- **`VotraExactDraw`** (`0x237FcAE817ce2F67912BA9cd26ecA85bff4f22B0`):
  - `enter()`
  - `open()`
  - `winnerBit(uint256 participantId)`
  - `settleParticipant(uint256 participantId)`
- **`VotraPrizeReserve`** (`0x916510A064c08Ff05de32C54b2be99eB674ad352`):
  - `claim(uint256 roundId)`
- **`VotraConfidentialAsset`** (`0x8A17E769bB6Be6b4b29dEf59061cFd8ccb63161e`):
  - `confidentialTransferAndCall(address to, bytes32 handle, bytes proof)`

## 5. FHEVM Relayer SDK Bindings
- Lazy-loaded import from `@zama-fhe/relayer-sdk/web`:
  - `createInstance({ ...SepoliaConfig, network: 'sepolia', provider })`
  - `fhe.createEncryptedInput(contractAddress, user).add64(value).encrypt()` -> returns `[handles[0], inputProof]`

## 6. Redesign Requirements & Non-Negotiables
- Maintain 100% compatibility with all above action handlers, ABIs, wallet subscribers, and evidence links.
- Preserve DOM selectors and action keys (`data-action="commitment"`, `data-action="deposit"`, `data-action="breach"`, `data-action="recovery"`, `data-action="enter"`, `data-action="open"`, `data-action="claim"`, `#goal`, `#setGoal`, `#breach`, `#recover`, `#txState`, `#txMetric`).
- Apply Talise-inspired fintech aesthetic: warm ash/paper canvas (`#eef2ed`), deep forest green cards (`#143a22`), vibrant mint cards (`#cbf5bf`), refined corner registration marks, modern Geist/Inter typography, precision Zama-yellow accents, smooth spring transitions, and responsive multi-viewport resilience (1440px, 1280px, 390px, 430px).
