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
