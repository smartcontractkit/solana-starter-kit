# CCIP Scripts

This directory contains reference implementation scripts for interacting with the Cross-Chain Interoperability Protocol (CCIP).

> 🎯 **This is the main overview and quick reference guide**  
> For detailed documentation: [SVM (Solana)](./svm/README.md) | [EVM (Ethereum)](./evm/README.md)

## Table of Contents

- [Directory Structure](#directory-structure)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [Script Categories](#script-categories)
  - [Solana VM (SVM) Scripts](#solana-vm-svm-scripts)
  - [Ethereum VM (EVM) Scripts](#ethereum-vm-evm-scripts)
- [Prerequisites](#prerequisites)
- [Troubleshooting](#troubleshooting)

## Directory Structure

The scripts are organized by virtual machine type and functionality:

```
ccip-scripts/
├── config/                    # Unified configuration for all chains
├── evm/                      # Ethereum Virtual Machine scripts
│   ├── router/               # Cross-chain transfers and messaging
│   ├── token/                # Token operations (drip faucet)
│   └── utils/                # EVM utility functions
└── svm/                      # Solana Virtual Machine scripts
    ├── router/               # Cross-chain transfers and messaging
    ├── token/                # Token delegation and fee preparation
    ├── receiver/             # CCIP message receivers
    └── utils/                # SVM utility functions
```

## Configuration

The configuration system provides a unified approach for both EVM and SVM chains. All network-specific settings, contract addresses, and chain selectors are centralized in the configuration files.

### Key Configuration Elements

- **ChainId** - Enum identifying supported chains (e.g., `ETHEREUM_SEPOLIA`, `SOLANA_DEVNET`)
- **CHAIN_SELECTORS** - Official CCIP chain selector values
- **EVMChainConfig** - Configuration for Ethereum chains
- **SVMChainConfig** - Configuration for Solana chains

### Using the Configuration

```typescript
// Import configuration elements
import {
  ChainId,
  getEVMConfig,
  getCCIPSVMConfig,
  getEVMFeeTokenAddress,
  FeeTokenType,
} from "./config";

// Get Ethereum configuration
const evmConfig = getEVMConfig(ChainId.ETHEREUM_SEPOLIA);
console.log("Router address:", evmConfig.routerAddress);

// Get Solana configuration
const svmConfig = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);
console.log("Router program ID:", svmConfig.routerProgramId);
```

## Quick Start

### For Solana (SVM) Development

1. **Setup**: Install dependencies and fund wallet with SOL
2. **CCIP Preparation**: `yarn svm:token:wrap` → `yarn svm:token:delegate` → `yarn svm:token:check`
3. **Send messages**: `yarn svm:token-transfer` / `yarn svm:arbitrary-messaging` / `yarn svm:data-and-tokens`

> **Cross-chain token (CCT) pool setup** moved to [ccip-solana-bs58-generator](https://github.com/smartcontractkit/ccip-solana-bs58-generator).

### For Ethereum (EVM) Development

1. **Setup**: Install dependencies and fund wallet with test ETH
2. **Get Test Tokens**: `yarn evm:token:drip`
3. **Send Messages**: `yarn evm:transfer` / `yarn evm:arbitrary-messaging`

## Script Categories

### Solana VM (SVM) Scripts

#### Router Operations

| Script                         | Purpose                                       |
| ------------------------------ | --------------------------------------------- |
| `yarn svm:fee`                 | Estimate CCIP fees for cross-chain operations |
| `yarn svm:token-transfer`      | Transfer tokens between chains                |
| `yarn svm:arbitrary-messaging` | Send arbitrary data between chains            |
| `yarn svm:data-and-tokens`     | Send both data and tokens in one transaction  |

> ⚡ **Faster-Than-Finality (CCIP 2.0 lanes only)**: add `--finality <finalized|safe|N>` to any of these scripts to request a source finality. For example, `yarn svm:token-transfer --finality 5` waits for 5 Solana block confirmations instead of full finality. The lane's verifiers, executor and token pools must allow the requested finality; CCIP 1.6 lanes always wait for full finality and reject the flag. See [ccip-lib/svm README](../ccip-lib/svm/README.md#ccip-20-faster-than-finality-ftf).

#### Token Operations

| Script                    | Purpose                                 |
| ------------------------- | --------------------------------------- |
| `yarn svm:token:wrap`     | Wrap SOL to wSOL for CCIP fees          |
| `yarn svm:token:delegate` | Delegate token authority to CCIP router |
| `yarn svm:token:check`    | Verify token delegations and balances   |

#### CCIP Receivers

| Script                          | Purpose                                   |
| ------------------------------- | ----------------------------------------- |
| `yarn svm:receiver:deploy`      | Deploy a new CCIP receiver program        |
| `yarn svm:receiver:initialize`  | Initialize receiver for incoming messages |
| `yarn svm:receiver:get-message` | Get latest received message               |
| `yarn svm:receiver:close`       | Close receiver storage accounts           |

#### CCIP v2 Receiver (required for Faster-Than-Finality data messages)

[`programs/ccip-receiver-v2`](../programs/ccip-receiver-v2) implements the CCIP 2.0 receiver interface (`ccip_receive_v2` + `get_ccvs_and_finality_config`). It registers itself with the 2.0 Router as a v2 receiver and lets you set, per source chain, which source finality it accepts.

| Command                         | Description                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `yarn svm:receiver-v2:build`    | Build the program (`anchor build -p ccip_receiver_v2`)                               |
| `yarn svm:receiver-v2:deploy`   | Deploy to devnet using `target/deploy/ccip_receiver_v2-keypair.json`                 |
| `yarn svm:receiver-v2:setup`    | Initialize, register with the Router (v2), and set the FTF policy (`--dry-run` to simulate) |
| `yarn svm:receiver-v2:status`   | Show deployment/registration/FTF policy and the latest received message              |

`setup` options: `--source-chain` (default `ethereum-sepolia`), `--block-depth N` (accept FTF requests waiting ≥ N blocks, `0` = finalized only, default `1`), `--allow-safe` (also accept the `safe` tag). Each step is skipped if already done.

> 📖 **For detailed usage, options, and troubleshooting**: See [SVM Scripts Documentation](./svm/README.md)

### Ethereum VM (EVM) Scripts

#### Router Operations

| Script                         | Purpose                                         |
| ------------------------------ | ----------------------------------------------- |
| `yarn evm:transfer`            | Transfer tokens from Ethereum to another chain  |
| `yarn evm:arbitrary-messaging` | Send arbitrary messages through CCIP            |
| `yarn evm:data-and-tokens`     | Send both data and tokens in single transaction |
| `yarn evm:check-fee`           | Estimate CCIP fees without sending transactions |

> ⚡ **Faster-Than-Finality (CCIP 2.0 lanes only)**: add `--finality <finalized|safe|N>` to any of these scripts to request a source finality. For example, `yarn evm:transfer --finality 5` waits for 5 block confirmations instead of full finality. FTF **data** messages need a CCIP v2 receiver on Solana; the bundled `ccip-basic-receiver` is v1 and only accepts finalized messages. `yarn evm:arbitrary-messaging` defaults to the v2 receiver from config (`receiverV2ProgramId`, set up with `yarn svm:receiver-v2:setup`) when it is configured, with or without `--finality`. It falls back to `receiverProgramId` otherwise. See [ccip-lib/evm README](../ccip-lib/evm/README.md#ccip-20-faster-than-finality-ftf).

#### Token Operations

| Script                | Purpose                               |
| --------------------- | ------------------------------------- |
| `yarn evm:token:drip` | Get test tokens on supported networks |

> 📖 **For detailed EVM documentation**: See [EVM Scripts Documentation](./evm/README.md)

## Prerequisites

### General Requirements

- Node.js v20+ (v23.11.0 recommended)
- Yarn package manager
- Git for cloning repositories

### Solana (SVM) Requirements

- Solana CLI tools
- Wallet with SOL on Devnet for testing
- Default keypair at `~/.config/solana/id.json`
- Optional: Test keypair at `~/.config/solana/keytest.json`

### Ethereum (EVM) Requirements

- Web3 wallet (MetaMask, etc.)
- Test ETH on supported networks
- Private key configuration for scripts

### Installation

```bash
# Install all dependencies
yarn install

# Verify TypeScript compilation
yarn type-check
```

## Troubleshooting

### Common Issues

#### Solana (SVM)

- **Insufficient Balance**: Ensure sufficient SOL for transaction fees
- **Permission Errors**: Run `yarn svm:token:delegate` before CCIP transfers
- **Network Issues**: Verify devnet connection and RPC endpoints

#### Ethereum (EVM)

- **Gas Estimation Failures**: Increase gas limits during network congestion
- **Token Approval Issues**: Ensure sufficient token approvals for transfers
- **Network Configuration**: Verify correct network settings in wallet

### Debug Commands

```bash
# Increase logging verbosity for SVM scripts
yarn svm:fee -- --log-level DEBUG

# Skip preflight checks for complex transactions
yarn svm:token-transfer -- --skip-preflight

# Use test keypair for isolated testing
yarn svm:token:wrap -- --use-test-keypair
```

### Getting Help

- **Detailed Guides**: [SVM Documentation](./svm/README.md) | [EVM Documentation](./evm/README.md)
- **Configuration Issues**: Check the `config/` directory for network settings
- **Script-Specific Help**: Add `--help` flag to any script for usage information

> 🔧 **For comprehensive troubleshooting**: See platform-specific documentation linked above
