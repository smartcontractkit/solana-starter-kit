<br/>
<p align="center">
<a href="https://chain.link" target="_blank">
<img src="./solana_logo.png" width="225" alt="Chainlink Solana logo">
</a>
</p>
<br/>

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/smartcontractkit/solana-starter-kit)

# Chainlink Solana Starter Kit

An [Anchor](https://www.anchor-lang.com/) workspace showing two things on Solana Devnet:

1. **Chainlink Data Feeds** — read prices on-chain (Rust program) and off-chain (TypeScript client).
2. **Chainlink CCIP 2.0** — cross-chain token transfers, arbitrary messaging, and programmable
   token transfers (data + tokens) between **Solana Devnet ↔ Ethereum Sepolia** (prod-testnet),
   built on the [`@chainlink/ccip-sdk`](https://docs.chain.link/ccip/tools/sdk/).

## Contents

- [Requirements](#requirements)
- [Setup](#setup)
- [Data Feeds](#data-feeds)
  - [Build & deploy the demo program](#build--deploy-the-demo-program)
  - [Run the on-chain client](#run-the-on-chain-client)
  - [Run the read-only client](#run-the-read-only-client)
  - [Run the integration test](#run-the-integration-test)
- [CCIP 2.0](#ccip-20)
  - [How it works](#how-it-works)
  - [CCIP setup](#ccip-setup)
  - [Command reference](#command-reference)
  - [Fees](#fees)
  - [Faster-Than-Finality (FTF)](#faster-than-finality-ftf)
  - [Manual execution](#manual-execution)
  - [CCIP programs](#ccip-programs)
  - [Troubleshooting](#troubleshooting)
- [Repository layout](#repository-layout)

## Requirements

- [Node.js v22+](https://nodejs.org/en/download/) (required by the ccip-sdk)
- [Rust](https://www.rust-lang.org/tools/install) (rustc 1.87+)
- [Solana CLI](https://docs.solanalabs.com/cli/install)
- [Anchor](https://book.anchor-lang.com/getting_started/installation.html) v1.1.2 — install via
  avm: `avm install 1.1.2 && avm use 1.1.2`
- A C compiler such as the one included in [GCC](https://gcc.gnu.org/install/)

> **Note:** if `anchor --version` still shows an old version after `avm use`, a standalone anchor
> binary is shadowing avm's. Invoke `~/.avm/bin/anchor` directly.

## Setup

```bash
cd solana-starter-kit
npm install
```

Create a wallet (or reuse your existing `~/.config/solana/id.json`):

```bash
solana-keygen new -o id.json
solana airdrop 5 $(solana address --keypair id.json) --url https://api.devnet.solana.com
```

Copy `.env.example` to `.env` and fill in:

| Variable                                | Required for          | Notes                                                      |
| --------------------------------------- | --------------------- | ---------------------------------------------------------- |
| `EVM_PRIVATE_KEY`                       | All EVM operations    | Sepolia ETH funded                                         |
| `EVM_RPC_URL`                           | All EVM operations    | Defaults to a public Sepolia endpoint                      |
| `SOLANA_RPC_URL`                        | All Solana operations | Defaults to `https://api.devnet.solana.com`                |
| `SOLANA_WALLET_PATH`                    | Solana signing        | Defaults to `~/.config/solana/id.json`                     |
| `EVM_RECEIVER_ADDRESS`                  | All sol2evm sends     | Set after [deploying the EVM receiver](#ccip-setup)        |
| `ANCHOR_PROVIDER_URL` / `ANCHOR_WALLET` | Integration test      | e.g. `https://api.devnet.solana.com` and your keypair path |

---

## Data Feeds

The demo program (`chainlink_solana_demo`) reads the latest round from a Chainlink Price Feed
on-chain and writes it to a user-provided account. The read-only client reads a feed directly
from TypeScript with no transaction.

### Build & deploy the demo program

```bash
anchor build
anchor keys sync        # writes the generated program ID into declare_id!
anchor build            # rebuild with the synced ID
anchor deploy --provider.cluster devnet
```

The deployed program ID must match `declare_id!` in
[`programs/chainlink_solana_demo/src/lib.rs`](programs/chainlink_solana_demo/src/lib.rs).

### Run the on-chain client

```bash
npm run read-data
```

Generates a fresh account, invokes the deployed program to fetch the feed price into it, then
prints the price. The feed address and program ID are set in [`read-data.ts`](read-data.ts).

### Run the read-only client

The same `npm run read-data` script also demonstrates the off-chain path via
[`@chainlink/solana-sdk`](https://www.npmjs.com/package/@chainlink/solana-sdk)'s `OCR2Feed`:
it subscribes to round updates and streams prices without sending a transaction. Edit
`CHAINLINK_FEED_ADDRESS` in [`read-data.ts`](read-data.ts) to pick a different Devnet feed
(see the [Solana feed list](https://docs.chain.link/solana)).

### Run the integration test

```bash
anchor test
```

Runs [`tests/chainlink-solana-demo-int-test.ts`](tests/chainlink-solana-demo-int-test.ts) against
Devnet: invokes the deployed program on the default feed and asserts the price is positive.
Requires `ANCHOR_PROVIDER_URL` and `ANCHOR_WALLET` (see `.env.example`).

---

## CCIP 2.0

Cross-chain messaging between **Solana Devnet and Ethereum Sepolia** over CCIP 2.0
(prod-testnet), using the ccip-sdk for everything: message building, fee quoting, sending,
execution-status tracking, and manual execution.

### How it works

- **Solana → Ethereum**: the SDK builds and signs a `ccip_send` instruction against the Solana
  router. On Sepolia, the CCIP OffRamp executes your `BasicCCIPReceiver` contract
  ([`contracts/evm/src/BasicCCIPReceiver.sol`](contracts/evm/src/BasicCCIPReceiver.sol)), which
  stores the latest message and lets its owner set per-source-chain finality policy.
- **Ethereum → Solana**: the SDK sends via the Sepolia router. On Devnet, the CCIP OffRamp
  program invokes your `ccip-receiver-v2` program's `ccip_receive_v2` instruction, which emits a
  `MessageReceived` event.
- **Fees** are paid in native SOL/ETH by default, or in LINK/WSOL (Solana) or LINK/WETH (Sepolia)
  with `--fee-token`.
- **Gas limits** for the destination callback are estimated automatically by the SDK
  (`estimateReceiveExecution`, +50% margin). Override with `--gas-limit` / `--compute-units`.
  Token-only sends use gas limit 0 — CCIP 2.0 then skips the receiver call entirely and
  delivers the tokens via the pool (the designed fast path).

### CCIP setup

One-time setup:

```bash
# 1. Deploy the EVM receiver on Sepolia; put the printed address in .env as EVM_RECEIVER_ADDRESS
npm run evm:receiver:deploy

# 2. Deploy the v2 receiver program on Solana (needed to receive messages, and for FTF)
npm run svm:program:build
npm run svm:program:deploy -- --program ccip-receiver-v2

# 3. Initialize it, register with the router, and set the finality policy (FTF-ready)
npm run svm:receiver-v2:setup -- --block-depth 1 --allow-safe

# 4. Approve your EVM sender address (required for data messages to the receiver)
npm run svm:receiver-v2:setup -- --approve-sender 0xYourEvmAddress

# 5. (Optional) deploy + set up the v2 sender program (program-initiated sends)
npm run svm:program:deploy -- --program ccip-sender-v2
npm run svm:sender-v2:setup -- --recipient 0xYourEvmReceiver
# 6. Check everything
npm run svm:receiver-v2:status
```

> ⚠️ Running `svm:receiver-v2:setup` **without** `--block-depth`/`--allow-safe` sets (or
> downgrades) the receiver's policy to finality-only.

### Command reference

Every send script prints a summary before sending and the message ID + explorer links after.

#### Send data (arbitrary messaging)

```bash
npm run sol2evm:data -- --message "Hello from Solana"
npm run evm2sol:data -- --message "Hello from Ethereum"
```

Options: `--receiver <address>` (override the default receiver), `--gas-limit`/`--compute-units`
(override the estimated callback budget).

#### Send through the ccip-sender-v2 program

The sol2evm scripts accept `--sender-program <programId>` to route the send through the deployed
`ccip-sender-v2` program instead of calling the router directly — the program-initiated flow:

```bash
npm run sol2evm:data -- --sender-program 7zGbs3PZSrZryQqJFpcYZf8kJ8BbxavmBngcLmYy9ds5
npm run sol2evm:token -- --sender-program 7zGbs3PZSrZryQqJFpcYZf8kJ8BbxavmBngcLmYy9ds5 --amount 1
```

The program pulls your tokens/fees and CPIs the router. The usual flags drive the send —
`--receiver` (default: `EVM_RECEIVER_ADDRESS`), `--gas-limit` (default: estimate + 50%),
`--finality` (default: finalized) and `--no-exec` — while the program's stored chain config fills
in the rest (custom CCVs, executor args). When the flag-derived values differ from the stored
config, the script first sends an `update_chain_config` transaction (the caller must be the
program's owner) and then the send — a stale config from a previous send is never silently
reused. The script quotes the fee off-chain and passes it as the program's required `max_fee`
(with 20% headroom). The script creates the program's token accounts and delegates your token
accounts to it as needed, so any SPL/Token-2022 mint works — fund your wallet with the token and
fee token first.

Change the stored config later (e.g. to set custom CCVs or executor args) without re-running
setup — the send scripts' flags now drive every send, so this is only needed for fields the
flags don't cover:

```bash
npm run svm:sender-v2:config -- --gas-limit 500000
npm run svm:sender-v2:config -- --recipient 0xNewReceiver --finality 1
npm run svm:sender-v2:config -- --finality finalized   # revert FTF (finality has no "unset" — finalized is the default)
npm run svm:sender-v2:config -- --remove   # disable the Sepolia lane
```

Unspecified options keep their stored values.

#### Send tokens

```bash
# BnM has 9 decimals on Solana, 18 on Sepolia
npm run sol2evm:token -- --amount 1                          # 1 BnM (human-readable; decimals resolved on-chain)
npm run evm2sol:token -- --amount 1                          # 1 BnM
npm run sol2evm:token -- --amount 1 --fee-token link         # pay the fee in LINK
npm run evm2sol:token -- --token 0x7798...A7B0 --amount 1    # any registered token
```

Options: `--token` (mint/address, default BnM), `--fee-token native|link|wsol` (Solana) /
`native|link|weth` (Sepolia), `--receiver`.

To Solana, `--receiver` is the address whose **associated token account** receives the tokens
(default: your Solana wallet) — there is no receiver program on a token-only send.

#### Send data + tokens (programmable token transfer)

```bash
npm run sol2evm:data-and-token -- --amount 1 --message "Hello with tokens"
npm run evm2sol:data-and-token -- --amount 1 --message "Hello with tokens"
```

To Solana, the message goes to the `ccip-receiver-v2` program while the tokens land in the
`--token-receiver` address's associated token account (default: your Solana wallet).

#### Fee quotes (read-only)

```bash
npm run sol2evm:fee
npm run evm2sol:fee -- --finality 5
npm run sol2evm:fee -- --token-amount 1    # quote including a token transfer
```

#### Manual execution

```bash
npm run sol2evm:manual-execute -- --message-id 0x...
npm run evm2sol:manual-execute -- --message-id 0x...
```

The SDK fetches the execution inputs from the CCIP API by message ID. `--gas-limit`/
`--compute-units` override the callback budget (useful to retry a message that failed with an
insufficient budget). The script skips the SDK's post-execute buffer sweep (it scans your
wallet's full transaction history and takes minutes on public RPC) — leftover buffers and
lookup tables auto-close on success; to recycle any stragglers and recover their rent, run
`npm run svm:cleanup` occasionally.

### Fees

- Default fee token is **native** (SOL on Solana, ETH on Sepolia). `--fee-token link` pays in
  LINK; `--fee-token wsol` (Solana) / `--fee-token weth` (Sepolia) pays in wrapped native —
  that bills the wrapped token account, not your wallet's SOL/ETH.
- Token transfers cost more than data-only messages (pool fees on top of the execution fee).
- Run the `*:fee` scripts first to see the exact cost before sending.
- Check balances on either chain with `npm run balance -- svm <mint>` / `npm run balance -- evm <tokenAddress>`
  (add `--owner <address>` for another owner).

### Faster-Than-Finality (FTF)

By default a message waits for full source finality. FTF relays it sooner:

```bash
npm run sol2evm:data -- --finality 5      # relay after 5 block confirmations
npm run evm2sol:data -- --finality safe   # relay at the safe head
npm run evm2sol:data -- --finality finalized   # explicit default
```

Requirements:

- **To Solana**: the `ccip-receiver-v2` program must be deployed with a `ccv_config` that accepts
  the requested finality (the setup command above sets "safe or ≥1 block").
- **To Ethereum**: the `BasicCCIPReceiver` owner sets a per-source-chain policy with
  `npm run evm:receiver:config`:

```bash
npm run evm:receiver:config -- --finality 1              # accept >= 1 block (FTF)
npm run evm:receiver:config -- --finality safe           # accept safe-tagged
npm run evm:receiver:config -- --finality 1 --allow-safe # both
npm run evm:receiver:config -- --remove                  # revert to finality-only
```

### Manual execution

Send with `--no-exec` to skip automated destination execution entirely (the executor is set to
the no-execution sentinel). Works on every send script — data, token, and data+token, both
directions. Execute later:

```bash
npm run sol2evm:data -- --no-exec --message "store this later"
npm run sol2evm:manual-execute -- --message-id 0x...   # when ready
```

Also works to retry a message whose automated execution failed (e.g. insufficient gas limit).

### CCIP programs

| Program                 | Purpose                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `ccip-basic-receiver`   | v1 receiver (finalized messages only)                                  |
| `ccip-receiver-v2`      | v2 receiver: `ccip_receive_v2`, per-source CCV + finality config (FTF) |
| `ccip-sender-v2`        | v2 sender program: `ccip_send` via staged account resolution           |
| `chainlink-solana-demo` | Data Feeds demo (unrelated to CCIP)                                    |

```bash
npm run svm:program:build                                  # anchor build (all programs)
npm run svm:program:deploy -- --program ccip-receiver-v2   # solana program deploy
npm run svm:receiver-v2:setup -- --block-depth 1 --allow-safe
npm run svm:receiver-v2:setup -- --approve-sender 0xYourEvmAddr   # optional sender allowlist
npm run svm:receiver-v2:status
npm run svm:sender-v2:setup -- --recipient 0xYourReceiver
```

Program IDs live in [`Anchor.toml`](Anchor.toml) and
[`ccip-scripts/utils/config.ts`](ccip-scripts/utils/config.ts); chain selectors are resolved from
the SDK's network registry so they can never drift from the on-chain lanes.

### Troubleshooting

- **`ReceiverError` / execution FAILURE on Ethereum** — the receiver callback ran out of gas.
  The scripts estimate gas automatically now; for an old stuck message, retry with
  `npm run sol2evm:manual-execute -- --message-id 0x... --gas-limit 400000`.
- **`NotEnoughGasForCall` on a token-only send** — a non-zero gas limit was forced on a
  token-only message. CCIP 2.0 skips the receiver call when `data` is empty and the gas
  limit is 0 (the designed fast path); the scripts now send 0 there. Recover an old stuck
  message with `npm run sol2evm:manual-execute -- --message-id 0x...`.
- **`AccountNotEnoughKeys` (3005) / execution FAILURE on Solana** — the message reached the
  receiver without its account list. CCIP 2.0 messages to Solana carry the receiver's
  accounts in the message itself (extraArgs `accounts` → `executorArgs`); the OffRamp only
  supplies the three standard accounts. The evm2sol scripts embed them automatically now.
- **`approved_sender` missing on Solana** — the EVM sender was never approved on
  `ccip-receiver-v2`. Approve it once:
  `npm run svm:receiver-v2:setup -- --approve-sender 0xYourEvmAddress`.
- **FTF message to Solana not executing** — check `npm run svm:receiver-v2:status`: the
  `ccv_config` must accept the finality you requested.
- **Noisy SDK logs** — the scripts silence the SDK's debug traces (simulation dumps, per-RPC
  `fetched` lines); run with `DEBUG_CCIP_SDK=1` to see them again.
- **Track any message** on the [CCIP Explorer](https://ccip.chain.link) by its message ID.

---

## Repository layout

```
├── programs/                    # Anchor programs
│   ├── chainlink_solana_demo/   #   Data Feeds demo
│   ├── ccip-basic-receiver/     #   CCIP v1 receiver
│   ├── ccip-receiver-v2/        #   CCIP v2 receiver (CCV + finality config)
│   └── ccip-sender-v2/          #   CCIP v2 sender program
├── contracts/evm/               # BasicCCIPReceiver (Solidity, forge-built)
├── ccip-scripts/
│   ├── sol2evm/                 # Solana → Ethereum: send-data, send-token, send-data-and-token, check-fee, manual-execute
│   ├── evm2sol/                 # Ethereum → Solana: same five
│   ├── program/                 # deploy, setup-receiver-v2, setup-sender-v2, update-sender-chain-config, status
│   ├── evm/                     # deploy-receiver, set-receiver-config (BasicCCIPReceiver on Sepolia)
│   ├── balance.ts               # chain-agnostic balance checker (svm/evm)
│   └── utils/                   # config (addresses/selectors/defaults), chains (SDK + wallets + gas estimation), finality (shared options), pdas (PDA derivations), extra-args (Borsh V3 codec), sender-program (program-routed sends)
├── read-data.ts                 # Data Feeds clients (on-chain + off-chain)
├── tests/                       # Anchor integration test (Data Feeds)
└── target/idl/                  # Generated IDLs (ccip_basic_receiver, ccip_receiver_v2, ccip_sender_v2 committed)
```

Disclaimer: Please note, this repo contains community examples only — these are not Chainlink products or services and are not supported or maintained by Chainlink. This code represents an example of using a Chainlink product or service, and is intended for demonstration and educational purposes only. It is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, may not have been audited, and may omit checks or error handling. Each party intending to use this example code does so entirely at their own risk and must perform its own audits, security and code review, key management, and testing before any production deployment and ensure the operation and performance of such code matches expectations. Neither Chainlink Labs nor the Chainlink Foundation deploys, operates, monitors, maintains or endorses any deployment of this code. Note that this is not a Chainlink product, feature or service, and there are no commitments made with respect to the code, including compatibility with future Chainlink releases. You should not rely on this code without first conducting your own technical, engineering, and security review. This code is also outside the scope of any Chainlink bug bounty programs. Neither Chainlink Labs, the Chainlink Foundation, nor Chainlink node operators are responsible for outcomes due to errors in this example or how it is deployed or operated, or liable for any resulting claims or damages. Use of the Chainlink Network is subject to the Chainlink Foundation [Terms of Service](https://chain.link/terms), which provides important information and disclosures. By using this code, you acknowledge and agree to these terms.
