# Evidence Plan

Evidence is generated, never hand-typed: model parity, adversarial traces, fairness distributions, HCU/gas measurements, deployment manifests, and decryption refusal probes live under `evidence/`. Each claim in README must link to an artifact or be labelled as pending.

## Visual Verification

Generated with Playwright 1.62.1 using the locally installed Chromium executable at `C:/Users/hp/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe`.

- Desktop viewport: 1440 x 1000; full-page render and interaction flow passed.
- Mobile viewport: 390 x 844; full-page render, hero visibility, and overflow check passed.
- Interaction checks: goal set, breach pauses weight, recovery resumes compliance.
- Captures: `evidence/screenshots/01-goal-set.png`, `02-compliant-state.png`, `03-breach-state.png`, `04-proof-receipt.png`, plus desktop/mobile renders.
- Machine report: `evidence/screenshots/report.json`.

## Wallet QA

Official Reown AppKit packages are installed. The static frontend exposes a
real EIP-1193 wallet service for account connection, Sepolia detection/switch,
disconnect, and guarded transaction requests. Deterministic Chromium checks
pass; extension-dependent signing, rejection, and receipt flows are recorded
as unexecuted in `evidence/wallet/playwright-report.json` because no automated
wallet profile was available.

## Relayer Endpoint Check

The continuation directive's public documentation probe was attempted on 2026-09-02. `https://docs.zama.org/protocol/relayer-sdk-guides` returned an HTTP 404 through curl (the older path is no longer a valid page); the PowerShell request separately failed with `The request was aborted: The connection was closed unexpectedly`. No public Sepolia relayer endpoint could be reliably extracted from that route, so live KMS evidence remains pending rather than invented.

The reference builds use the relayer SDK's built-in `SepoliaConfig`/`web()` transport. VOTRA attempted that live initialization on 2026-09-02; it failed before any transaction with `undici ConnectTimeoutError: Connect Timeout Error`. This is recorded as a transport failure, not an authorization failure.

## Live page capture

`npm run capture:chain` uses the supplied Playwright Chromium executable to capture the live Season 4 brief and the Sepolia Etherscan source pages for Pool, Draw, Asset, and Reserve. The brief returned HTTP 200 and its screenshot is stored. Etherscan returned Cloudflare HTTP 403 interstitials in this browser run; those screenshots and statuses are retained in `evidence/live/capture-report.json` and are not treated as source-page content. Etherscan source verification itself is independently complete via the Hardhat verifier and the URLs listed in the deployment evidence. The brief text captured by that run is quoted verbatim in `COMPLIANCE.md`.

Canonical verified source URLs:

- Pool: https://sepolia.etherscan.io/address/0x2E47C272baaEfb584593d61d8Aee6E81CDF1463c#code
- ExactDraw: https://sepolia.etherscan.io/address/0x237FcAE817ce2F67912BA9cd26ecA85bff4f22B0#code
- Asset: https://sepolia.etherscan.io/address/0x8A17E769bB6Be6b4b29dEf59061cFd8ccb63161e#code
- YieldAdapter: https://sepolia.etherscan.io/address/0xA97FAE6911FA2ecD5787aB990fDB367d39B1632D#code
- Reserve: https://sepolia.etherscan.io/address/0x916510A064c08Ff05de32C54b2be99eB674ad352#code

The previous four-contract reserve-funded canonical deployment is historical
evidence only: evidence/deployments/votra-exact-canonical.json and evidence/live/canonical-campaign.json.

## Experimental proof artifacts

- Fresh history-sensitive live campaign: `evidence/history-sensitivity/live-campaign.json`.
- Fresh history model/chain cross-check: `evidence/live/model-chain-crosscheck.json`.
- Receipt-backed deployed guard attempts: `evidence/adversarial/executable-receipts.json` (8 independently mined Sepolia status-0 receipts, 8 expected reverts, 0 failures).
- Final cost classification: `evidence/benchmarks/final-cost-summary.json`.
- Final machine-enforced release gate: `evidence/release/final-gate.json`.
- Canonical yield verification: evidence/live/canonical-yield-verification.json
- Full economic model: evidence/model/full-economic-model.json
- Yield release gate: evidence/release/yield-gate.json

- Canonical state specification: `evidence/model/canonical-state-transition.json`
- Covenant adversarial traces: `evidence/adversarial/covenant-corpus.json`
- Forward-only randomized invariant: `evidence/invariants/forward-only.json` (1,000 scenarios, 0 failures)
- Covenant-history fairness: `evidence/fairness/covenant-weighted.json` (12,000 scenarios, 0 mismatches, 0 invariant failures)

The canonical live yield campaign is proven through three funded participants, encrypted commitments and deposits, breach/recovery transitions, separate principal accounting, deterministic testnet yield realization, yield-only reserve funding, encrypted exact-draw opening, authorized winner-bit decryption, a positive winner, confidential settlement, and claims in evidence/live/canonical-yield-campaign.json. Final balances were equal at 150; CW values were 34200, 118800, and 142200; participant C won and claimed the 1000 realized-yield prize while principal remained 450.

The dedicated history experiment is separate from the positive-winner canonical campaign. It gives A, B, and C equal final balances of `150` but derives distinct commitment-weighted histories of `136800`, `39600`, and `131400`; the source transactions and zero-divergence comparison are preserved in `evidence/history-sensitivity/live-campaign.json` and `evidence/live/model-chain-crosscheck.json`.
