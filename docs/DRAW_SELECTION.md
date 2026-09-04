# Draw Selection

## Model

For encrypted committed weights `CW_i`, the required distribution is `P(i) = CW_i / sum(CW)`.

## Exact construction

`VotraExactDraw` sums encrypted weights, samples encrypted candidates uniformly from `[0, MAX_TOTAL_WEIGHT)`, accepts the first candidate satisfying `candidate < encryptedTotal`, and selects the participant whose encrypted cumulative interval contains that target. Conditioning a uniform sample on acceptance gives an exactly uniform target in `[0, totalWeight)`; cumulative intervals therefore implement `CW_i / totalWeight` without floating point or public balances.

## Bound and termination

`MAX_TOTAL_WEIGHT` is a public deployment bound. It must exceed the maximum permitted total committed weight for the round. `attempts` is a public finite retry budget. If all candidates are rejected, `_resolved` is false and no winner is claimed. This is an explicit availability state, not a biased fallback.

The bound must be a power of two because FHEVM `randEuint64` rejects other
bounds. The canonical deployment uses `2^20 = 1,048,576`; totals must remain
strictly below that value. Exceeding the bound requires a new deployment with a
larger supported power-of-two domain rather than truncation.

## Privacy

Weights, total, candidates, acceptance, target, cumulative values, and winner bits remain encrypted under the FHE ACL. Only an authorized participant can decrypt its winner bit.

## Complexity and failure modes

Opening costs `O(n * attempts)` encrypted operations; winner evaluation costs `O(index)` encrypted additions/comparisons. Under a valid bound, rejection probability is `1 - total/MAX_TOTAL_WEIGHT`; the bound and attempt budget must be chosen so exhaustion is operationally rare and measured. A zero total weight cannot resolve and is represented by `_resolved = false`.

This replaces the historical fixed-slot coordinator for future canonical deployments. The prior fixed-slot deployment remains archived and is not used as evidence of exact positive-winner fairness.
