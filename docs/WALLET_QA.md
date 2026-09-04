# Wallet QA

The official Reown packages are installed (`@reown/appkit` and
`@reown/appkit-adapter-ethers`). The repository is a static HTML server with no
browser bundler, so the runtime wallet boundary is implemented as a small
EIP-1193 service. It performs real account requests, chain detection, Sepolia
switching, disconnect, and guarded transaction submission. A Reown project ID
must be supplied as `VOTRA_REOWN_PROJECT_ID` before AppKit modal initialization
can be enabled in a bundled deployment.

The Chromium harness executed deterministic UI QA at the existing desktop and
mobile sizes. No browser extension or WalletConnect test profile was available,
so real popup approval/rejection and receipt confirmation were not fabricated.
See `evidence/wallet/playwright-report.json`.
