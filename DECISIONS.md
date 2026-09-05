# Decisions

## D-001

- **DATE:** 2026-09-02
- **QUESTION:** When does a saver recover after breaching?
- **OPTIONS:** Next round only; immediate accrual.
- **DECISION:** Immediate recovery for new weight accrual. The breach transition and encrypted cycle count remain scoped to the current round.
- **WHY:** It is fairer to a saver who restores the floor while preventing retroactive repair. Repeated breach/recovery cannot increase expected weight over steady compliance because each non-compliant interval earns zero and the cycle count is measurable in evidence.
- **EVIDENCE:** `DISCOVERY.md` invariant 4; adversarial test target in `TASK.md`.
- **TRADEOFF:** More generous UX, more state-transition complexity.
- **REVISIT CONDITION:** Measured encrypted implementation shows a timing or HCU exploit.

## D-002

- **QUESTION:** What determines prize weight?
- **DECISION:** Balance-time contribution gated by the encrypted commitment floor, rather than a final-balance multiplier.
- **WHY:** Final multipliers allow late deposits to erase discipline history; forward-only TWAB preserves causality.
- **TRADEOFF:** Every mutation must advance the accumulator.
- **REVISIT CONDITION:** FHEVM cost makes the measured operating envelope unusable.

## D-003

- **QUESTION:** How should draws avoid bias?
- **DECISION:** Start with independently derived rejection sampling; compare against an oblivious range draw after HCU measurement.
- **WHY:** Exactness is easier to audit, while the decision remains empirical.
- **REVISIT CONDITION:** ORD is materially cheaper without weakening proof.

## D-004

- **DATE:** 2026-09-05
- **QUESTION:** What funds the prize reserve in the canonical deployed flow?
- **OPTIONS:** Deployer minted pot; deterministic testnet yield adapter; external market strategy.
- **DECISION:** Add `VotraYieldAdapter` as the canonical testnet yield source with strict principal / realized-yield separation, and deploy a fresh five-contract stack using yield-only reserve funding.
- **WHY:** Sepolia offers no genuine external market yield source, but the deployed system should prove that yield provenance, realized yield, reserve funding, exact CW selection, settlement, and claim are one connected lifecycle. The adapter is explicitly labeled **TESTNET YIELD ADAPTER / NOT LIVE MARKET YIELD**.
- **EVIDENCE:** `evidence/live/canonical-yield-campaign.json`, `evidence/model/full-economic-model.json`, `evidence/release/yield-gate.json`.
- **TRADEOFF:** Deterministic testnet yield rather than a live external market strategy.
- **REVISIT CONDITION:** A trusted testnet market-yield source becomes available without weakening principal conservation.
