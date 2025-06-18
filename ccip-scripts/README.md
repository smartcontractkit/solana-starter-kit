# CCIP Scripts

This directory contains reference implementation scripts for interacting with the Cross-Chain Interoperability Protocol (CCIP).

> 🎯 **This is the main overview and quick reference guide**  
> For detailed documentation: [SVM (Solana)](./svm/README.md) | [EVM (Ethereum)](./evm/README.md)

## Table of Contents

- [Directory Structure](#directory-structure)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [Running Scripts](#running-scripts)
  - [Solana VM (SVM) Scripts](#solana-vm-svm-scripts)
  - [Ethereum VM (EVM) Scripts](#ethereum-vm-evm-scripts)
- [Configuration Testing](#configuration-testing)
- [Troubleshooting](#troubleshooting)

## Directory Structure

The scripts are organized by virtual machine type and functionality:

- `config/` - Unified configuration for all chains and platforms
- `evm/` - Scripts for Ethereum Virtual Machine chains
  - `router/` - EVM Router operations (transfers, messaging)
  - `token/` - EVM token operations
  - `utils/` - EVM utility functions
- `svm/` - Scripts for Solana Virtual Machine
  - `router/` - SVM Router operations (transfers, messaging)
  - `token/` - SVM token operations (delegation, wrapping)
  - `pool/` - Token pool management (initialization, configuration)
  - `admin/` - Token admin registry management
  - `utils/` - SVM utility functions
  - `receiver/` - Receivers for CCIP messages and token transfers

## Configuration

The configuration system has been unified to provide a consistent approach for both EVM and SVM chains. All network-specific settings, contract addresses, and chain selectors are centralized in the configuration files.

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

// Get a specific fee token address
const linkTokenAddress = getEVMFeeTokenAddress(evmConfig, FeeTokenType.LINK);
```

## Running Scripts

The scripts are organized by chain type and function. Use the yarn/npm scripts defined in `package.json` to run them.

### Solana VM (SVM) Scripts

#### Router Operations

```bash
# Check CCIP fee estimation
yarn ccip:fee

# Token transfer from Solana to another chain
yarn svm:token-transfer

# Send arbitrary messages through CCIP
yarn svm:arbitrary-messaging

# Send both data and tokens in a single transaction
yarn svm:data-and-tokens
```

#### Token Operations

```bash
# Create SPL Token-2022 with metadata
yarn svm:token:create

# Mint tokens
yarn svm:token:mint

# Token preparation for CCIP
yarn svm:token:wrap                 # Wrap SOL to wSOL
yarn svm:token:delegate             # Delegate authority to CCIP
yarn svm:token:check                # Verify delegations
```

#### Token Pool Management

```bash
# Token pool management (2-step process)
yarn svm:pool:init-global-config    # Step 1: Global config (once per deployment)
yarn svm:pool:initialize            # Step 2: Token pool (once per token)
yarn svm:pool:get-info              # Get detailed information about existing pools
yarn svm:pool:set-router            # Set configured CCIP router for pool (owner only)
```

#### Token Admin Registry Management

```bash
# Token admin registry operations (2-step process)
yarn svm:admin:propose-administrator  # Step 1: Propose administrator (mint authority only)
yarn svm:admin:accept-admin-role        # Step 2: Accept admin role (completes two-step process)
yarn svm:admin:create-alt               # Create Address Lookup Table for token pool operations
```

> 📖 **For detailed usage, options, and troubleshooting**: See [SVM Scripts Documentation](./svm/README.md)

### Ethereum VM (EVM) Scripts

#### Router Operations

```bash
# Token transfer from Ethereum to another chain
yarn evm:transfer

# Send arbitrary messages through CCIP
yarn evm:arbitrary-messaging

# Send both data and tokens in a single transaction
yarn evm:data-and-tokens
```

#### Token Operations

```bash
# Get test tokens on supported networks
yarn evm:token:drip
```

## Quick Start

### For Solana (SVM) Development

1. Set up your Solana wallet and fund with SOL
2. Create tokens: `yarn svm:token:create`
3. Set up token administration: `yarn svm:admin:propose-administrator`
4. Set up token pools: `yarn svm:pool:init-global-config` → `yarn svm:pool:initialize`
5. Prepare for CCIP: `yarn svm:token:wrap` → `yarn svm:token:delegate`

### For Ethereum (EVM) Development

1. Set up your EVM wallet and fund with test tokens
2. Get test tokens: `yarn evm:token:drip`
3. Send messages: `yarn evm:transfer` / `yarn evm:arbitrary-messaging`

> 📖 **Detailed guides**: [SVM Documentation](./svm/README.md) | [EVM Documentation](./evm/README.md)

## Configuration Testing

To verify that the configuration is working correctly, you can inspect the configuration values by adding custom logging to your scripts or creating a dedicated test script.

## Troubleshooting

### Quick Fixes

- **Insufficient Balance**: Ensure you have enough tokens/ETH/SOL for transactions
- **Permission Errors**: Run delegation scripts before CCIP transfers
- **Network Issues**: Try increasing gas/priority fees during congestion

> 🔧 **Detailed troubleshooting guides**: [SVM Troubleshooting](./svm/README.md#troubleshooting) | [EVM Troubleshooting](./evm/README.md)
