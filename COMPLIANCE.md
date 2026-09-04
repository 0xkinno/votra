# Compliance Anchor

**Status: verified against the live Season 4 brief on 2026-09-02.**

> For this season, the challenge is to build a Confidential Prize Savings App - a production-ready, confidential version of PoolTogether: a "no-loss lottery" where users deposit tokens into a shared prize pool, the pool's yield is awarded as prizes through periodic draws, and deposits, balances, and winnings stay encrypted end-to-end using the Zama Protocol.

Source: https://forms.zama.org/developer-program-mainnet-season4-bounty-track (fetched 2026-09-02).

VOTRA remains inside that definition: winner selection executes over encrypted balances, while its additional covenant term gates whether balance-time earns prize weight. The central quantity is still balance-derived:

`CW_i = integral(B_i(t) * C_i(t) dt)`

`B_i(t)` is the encrypted balance and `C_i(t)` is the encrypted covenant state. The covenant gate is additional, not a replacement for balance as the basis of selection; a breach stops only future accrual and never rewrites historical compliant weight.
