# CCIP Scripts

This directory contains reference implementation scripts for interacting with the Cross-Chain Interoperability Protocol (CCIP).

## Table of Contents

- [Directory Structure](#directory-structure)
- [Configuration](#configuration)
- [Running Scripts](#running-scripts)
  - [Solana VM (SVM) Scripts](#solana-vm-svm-scripts)
  - [Ethereum VM (EVM) Scripts](#ethereum-vm-evm-scripts)
- [Token Management](#token-management)
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
  FeeTokenType
} from './config';

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
# Wrap native SOL to wSOL (needed for token operations)
yarn svm:token:wrap

# Specify custom amount in lamports
yarn svm:token:wrap --amount 20000000

# Delegate token authority (required for CCIP transfers)
yarn svm:token:delegate

# Check token approval status
yarn svm:token:check
```

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

## Token Management

Before sending tokens through CCIP from Solana, you must perform these steps:

1. Wrap SOL if you're using native SOL as the source token:
   ```bash
   yarn svm:token:wrap
   ```

2. Delegate token authority to the CCIP program:
   ```bash
   yarn svm:token:delegate
   ```

3. Verify token approvals before attempting transfers:
   ```bash
   yarn svm:token:check
   ```

## Configuration Testing

To verify that the configuration is working correctly, you can inspect the configuration values by adding custom logging to your scripts or creating a dedicated test script.

## Troubleshooting

### Common Issues

1. **Transaction Timeout** - If you encounter "block height exceeded" errors, try increasing the commitment levels or adding retries in your transactions.

2. **Insufficient Balance** - Ensure you have enough balance for both the token transfer and gas fees. For Solana, remember that token operations require wrapped SOL.

3. **Missing Token Delegation** - CCIP transfers from Solana require token delegation to the CCIP program. Run `yarn svm:token:delegate` before token transfers.

4. **Network Congestion** - During peak usage times, consider adjusting the confirmation options or increasing transaction priority. 