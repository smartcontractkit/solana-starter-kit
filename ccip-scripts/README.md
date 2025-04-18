# CCIP Scripts

This directory contains reference implementation scripts for interacting with the Cross-Chain Interoperability Protocol (CCIP).

## Directory Structure

- `config/` - Unified configuration for all chains and platforms
- `evm/` - Scripts for Ethereum Virtual Machine chains
- `svm/` - Scripts for Solana Virtual Machine

## Configuration

The configuration system has been unified to provide a consistent approach for both EVM and SVM chains. All network-specific settings, contract addresses, and chain selectors are centralized in the `config/index.ts` file.

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
  getSVMConfig, 
  getEVMFeeTokenAddress,
  FeeTokenType
} from './config';

// Get Ethereum configuration
const evmConfig = getEVMConfig(ChainId.ETHEREUM_SEPOLIA);
console.log("Router address:", evmConfig.routerAddress);

// Get Solana configuration
const svmConfig = getSVMConfig(ChainId.SOLANA_DEVNET);
console.log("Router program ID:", svmConfig.routerProgramId);

// Get a specific fee token address
const linkTokenAddress = getEVMFeeTokenAddress(evmConfig, FeeTokenType.LINK);
```

## Running Scripts

The scripts are organized by chain type and function. Use the npm scripts defined in `package.json` to run them.

### EVM Scripts

```bash
# Send tokens from Ethereum to Solana
npm run evm:transfer

# With LINK as the fee token
npm run evm:transfer:link

# With debug logging
npm run evm:transfer:debug
```

### SVM Scripts

```bash
# Send tokens from Solana to Ethereum
npm run ccip:send

# With wrapped SOL as fee token
npm run ccip:send:wrapped

# With LINK as fee token
npm run ccip:send:link
```

### Token Management

```bash
# Delegate token authority (required for CCIP transfers)
npm run token:delegate

# Check token approvals
npm run token:check
```

## Configuration Testing

To verify that the configuration is working correctly, run:

```bash
npm run test:config
```

This will load and display the configuration for all supported chains. 