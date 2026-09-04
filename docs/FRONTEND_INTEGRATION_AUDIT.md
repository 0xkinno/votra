# Frontend Integration Audit

This audit records the functional surface after the routing pass. Contract addresses and economic semantics are unchanged.

| UI location | Action | Current behavior | Real backend function | Route / destination | Status |
|---|---|---|---|---|---|
| Navbar logo | Return home | Loads the landing shell | None | `/` | Pass |
| Navbar Connect wallet | Connect / account | Opens Reown AppKit; account opens AppKit account view | EIP-1193 provider | Current route | Pass |
| Commitment panel | Set commitment | Encrypts input, requests signature, waits for receipt | `VotraCommitmentPool.setCommitment` | `/` | Pass |
| Commitment panel | Deposit | Encrypts amount, signs, waits for receipt | `VotraCommitmentPool.deposit` | `/` | Pass |
| Commitment panel | Breach | Encrypts withdrawal amount, signs, waits for receipt | `VotraCommitmentPool.withdraw` | `/` | Pass |
| Commitment panel | Recovery | Encrypts redeposit amount, signs, waits for receipt | `VotraCommitmentPool.deposit` | `/` | Pass |
| Draw panel | Enter draw | Signs and waits for receipt | `VotraExactDraw.enter` | `/` | Pass |
| Draw panel | Open draw | Signs and waits for receipt | `VotraExactDraw.open` | `/` | Pass |
| Draw panel | Claim | Signs and waits for receipt | `VotraPrizeReserve.claim` | `/` | Pass |
| Proof cards | View proof | Opens human-readable route | Evidence renderer | `/proof/<artifact>` | Pass |
| Proof cards | Raw evidence | Explicit secondary link | Static JSON | Evidence file | Pass |
| Contract cards | Etherscan | Opens verified canonical contract | Explorer | Sepolia address | Pass |
| Contract cards | GitHub source | Opens exact source file | Repository | `github.com/0xkinno/votra` | Pass |

Transaction states are `READY`, `SIGN IN WALLET`, `PENDING`, `CONFIRMED`, `USER REJECTED`, and `FAILED`; success is only rendered after `tx.wait()` returns. The UI no longer advances local balance or weight as a simulated success path.

Known operational boundary: browser wallet approval and relayer availability depend on the user's environment. Those cases surface as explicit failure state and do not fabricate a receipt.
