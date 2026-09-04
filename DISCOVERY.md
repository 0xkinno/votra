# Discovery

## Sponsor Primitive

Zama FHEVM lets a contract compute over encrypted values while ACLs and user/public decryption boundaries control disclosure.

## Current Season Requirement

VOTRA must be a functioning confidential prize-savings dApp whose winner selection executes over encrypted, balance-derived weight. The commitment multiplier is additive to that requirement, never a replacement. The live brief must be re-read before submission and quoted in `COMPLIANCE.md`.

## What Everyone Assumes

Prize savings can reward either final balance or a public eligibility flag. Both expose a useful behavioral signal: how much a saver has, or whether they fell below a goal.

## What the Infrastructure Actually Does

FHE hides values, but it does not automatically hide event timing, transaction count, participant identity, or the fact that a draw settled. Every balance mutation is therefore a privacy-sensitive state transition and must advance history before changing state.

## Reproduction

The local reference model in `packages/reference-model/index.js` executes deposits, withdrawals, breach/recovery, round boundaries, principal accounting, and weighted selection using integer arithmetic. It is the oracle for the eventual encrypted implementation.

## Technical Constraint / Contradiction

The strongest privacy boundary conflicts with the simplest TWAB implementation: historical balance-time weight needs time advancement at every mutation, while a public event stream can reveal when a user is active or breaches. The protocol can preserve encrypted amounts and compliance, but not claim total metadata privacy.

## Who Suffers

People using employer matches, credit-union discipline pools, or emergency-fund programs who need a behavioral incentive without making their financial position legible to an operator, employer, or competitor.

## Existing Approaches

Serein demonstrates exact confidential weighted selection and rejection sampling. Sotto demonstrates an oblivious range draw and operationally explicit HCU testing. SaveTogether emphasizes approachable savings UX and bounded authority. These are reference points, not implementation templates.

## Competitor Delta

Those systems primarily make balance or eligibility private. VOTRA makes the *private commitment itself* an enforceable, time-sensitive source of future prize weight.

## VOTRA Insight

Commitment is not a one-time multiplier. It is a private floor evaluated over each balance interval, so a breach permanently loses only future earning power while compliant history remains immutable.

Traditional prize savings weights capital over time. VOTRA weights capital over time only while a private financial commitment is being satisfied. The deeper primitive is confidential covenant enforcement: private financial state -> encrypted policy evaluation -> deterministic economic consequence, without public disclosure of the underlying state. This is a narrow implementation claim, not a claim that the idea has no prior art.

## New Capability

A savings product can reward sustained financial discipline without revealing either the target or the balance to the public observer.

## Hard Invariant

1. Historical compliant weight is immutable.
2. Non-compliant intervals never become compliant retroactively.
3. Principal is conserved independently of prizes.
4. Breach/recover cycling does not increase expected weight versus steady compliance; recovery accrues immediately but encrypted cycle counts are retained per round.

## Failure Experiment

The implementation must compare encrypted-contract traces against the plaintext oracle across randomized scenarios. Any mismatch, stale commitment reuse, replayed draw, or unauthorized decryption is a release blocker.

## Proof Plan

Publish source-verified addresses, transaction traces, model parity, adversarial results, HCU measurements, principal conservation, and decryption refusal probes under `evidence/` and `/proof`.

## Known Unknowns

The exact Season 4 wording, current FHEVM API surface, Sepolia deployment addresses, and gas envelope must be rechecked against live primary sources immediately before deployment.

## Decision

Proceed with commitment-weighted TWAB as the core thesis, keep metadata leakage explicit, and defer optional yield adapters or identity abstractions until the core invariant is measured.
