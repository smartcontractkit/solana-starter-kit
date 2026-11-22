# CCIP v2 Receiver (Solana)

A minimal receiver for the **CCIP 2.0** interface on Solana. Use it for EVM → Solana data messages that request **Faster-Than-Finality (FTF)**.

The bundled [`ccip-basic-receiver`](../ccip-basic-receiver) is a v1 receiver. The CCIP 2.0 OffRamp treats any receiver that is not registered in the Router's `ReceiverRegistry` as v1, and v1 receivers only accept finalized messages. An FTF data message sent to a v1 receiver fails execution with `RequestedFinalityNotAllowed`.

## Instructions

| Instruction | Caller | Purpose |
| --- | --- | --- |
| `initialize(router)` | upgrade authority | Creates `state` and `messages_storage` PDAs |
| `register_with_router` | owner | CPIs the Router's `register_receiver`, signed by the `["ccip_receiver_registration", router]` PDA, to register `receiver_version = 2` |
| `set_ccv_config(params)` / `remove_ccv_config` | owner | Per-source-chain CCV requirements and **allowed finality** (`flags`, `block_depth`) |
| `get_ccvs_and_finality_config` | OffRamp (view) | Returns the CCV + finality policy; without a config account it returns lane defaults + finalized only |
| `ccip_receive_v2(message)` | OffRamp | Verifies the OffRamp signer PDA + Router `allowed_offramp`, stores the latest message |
| `update_router`, `get_latest_message` | owner / anyone | Admin / read helpers |

The receiver uses the same `state` and `messages_storage` seeds as `ccip-basic-receiver`. The accounts passed by `yarn evm:arbitrary-messaging` are therefore `[state, messages_storage]` with writable bitmap `2`, the same as for the basic receiver.

The finality policy follows the EVM `finality` `uint32`: the high 16 bits are flags (`0x0001` = `safe`) and the low 16 bits are the block depth. With `block_depth = N`, the receiver accepts any request that waits ≥ N blocks. `0` means finalized only.

This example does not handle token transfers, sender allowlists or failure recovery. Add these before using it in production.

## Usage

```bash
yarn svm:receiver-v2:build
yarn svm:receiver-v2:deploy                  # needs ~2.5 devnet SOL for program rent
yarn svm:receiver-v2:setup --dry-run         # simulate initialize + register + set_ccv_config
yarn svm:receiver-v2:setup --block-depth 1   # apply (Sepolia source by default)
yarn svm:receiver-v2:status

# Send an FTF message from Sepolia (the receiver defaults to receiverV2ProgramId from config)
yarn evm:arbitrary-messaging --data "Hello FTF" --finality 5
yarn svm:receiver-v2:status                  # shows the received message
```

To deploy your own copy, generate a new keypair (`solana-keygen new -o target/deploy/ccip_receiver_v2-keypair.json`). Then update `declare_id!` in `src/lib.rs`, `Anchor.toml` and `receiverV2ProgramId` in `ccip-scripts/config/index.ts`, and rebuild.
