# Privacy Model

| Value | Visibility | Who can decrypt | When | Leakage / mitigation |
|---|---|---|---|---|
| Deposit amount | Encrypted | Saver, authorized contract flow | User action | Timing and gas remain public; batch operations can reduce correlation |
| Balance | Encrypted | Saver | User-authorized reveal | No public balance events |
| Commitment floor | Encrypted | Saver | User-authorized reveal | Frozen per round; no replacement handle |
| Compliance state | Encrypted | Saver / draw logic | Round settlement | Transition timing can leak activity |
| Committed weight | Encrypted | Draw logic; aggregate only if proven necessary | Draw | Avoid individual aggregate disclosure |
| Winner | Public address or private claim path | Protocol-defined | Settlement | Outcome itself is observable; amount can remain encrypted |
| Participant identity | Wallet-public | Chain observers | Registration/tx | VOTRA is not a mixer |
