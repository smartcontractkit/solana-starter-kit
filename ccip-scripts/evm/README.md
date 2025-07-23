# EVM CCIP Scripts - Technical Documentation

This guide provides comprehensive documentation for EVM (Ethereum Virtual Machine) CCIP scripts, enabling cross-chain communication from EVM chains to Solana.

> 📖 **This is the detailed technical reference for EVM operations**  
> For overview and quick start: [Main CCIP Scripts README](../README.md)

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Available Scripts](#available-scripts)
  - [Router Scripts](#router-scripts)
  - [Token Scripts](#token-scripts)
- [Command Line Options](#command-line-options)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before running EVM scripts, ensure you have:

- Node.js v20+ installed
- An EVM wallet with:
  - Test ETH on your chosen network (Sepolia, Base Sepolia, etc.)
  - Test tokens (BnM, LINK) for transfers
- Environment variables configured (see below)

## Environment Setup

### Required Environment Variables

Create a `.env` file in the project root:

```bash
# Required
EVM_PRIVATE_KEY=your_private_key_here

# Network-specific RPC URLs (at least one required)
EVM_RPC_URL=https://your-ethereum-sepolia-rpc
BASE_SEPOLIA_RPC_URL=https://your-base-sepolia-rpc
OPTIMISM_SEPOLIA_RPC_URL=https://your-optimism-sepolia-rpc
BSC_TESTNET_RPC_URL=https://your-bsc-testnet-rpc
ARBITRUM_SEPOLIA_RPC_URL=https://your-arbitrum-sepolia-rpc
```

### Getting Test Tokens

Before sending cross-chain messages, you need test tokens:

```bash
# Get test tokens from faucet
yarn evm:token:drip
```

This will provide you with test BnM and LINK tokens on your configured network.

## Available Scripts

### Router Scripts

Router scripts handle cross-chain message sending from EVM chains to Solana.

#### 1. Token Transfer

Send tokens from an EVM chain to Solana.

```bash
yarn evm:transfer
```

**Supported Options:**

- `--chain-id <chain>` - Source chain (ethereum-sepolia, base-sepolia, etc.)
- `--token <address>` - Token address to transfer
- `--amount <amount>` - Amount in raw units (e.g., "1000000000000000000" for 1 token with 18 decimals)
- `--token-amounts <pairs>` - Multiple tokens: "token1:amount1,token2:amount2"
- `--fee-token <type>` - Fee payment token (native, link, wrapped)
- `--token-receiver <address>` - Solana wallet to receive tokens
- `--log-level <level>` - Logging verbosity (0-5)

**Examples:**

```bash
# Single token transfer
yarn evm:transfer --token 0x779877A7B0D9E8603169DdbD7836e478b4624789 --amount 1000000000000000000

# Multiple token transfer
yarn evm:transfer --token-amounts "0x779877A7B0D9E8603169DdbD7836e478b4624789:1000000000000000000,0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05:2000000000000000000"

# Custom fee token and receiver
yarn evm:transfer --token 0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05 --amount 5000000000000000000 --fee-token link --token-receiver YourSolanaWalletAddress
```

#### 2. Arbitrary Messaging

Send custom data messages to Solana.

```bash
yarn evm:arbitrary-messaging
```

**Supported Options:**

- `--data <message>` - Message data (text or hex)
- `--receiver <address>` - Solana program/account to receive message
- `--compute-units <units>` - Solana compute units for execution
- `--fee-token <type>` - Fee payment token
- `--log-level <level>` - Logging verbosity

**Examples:**

```bash
# Send text message
yarn evm:arbitrary-messaging --data "Hello Solana!" --receiver YourSolanaProgramAddress

# Send hex data
yarn evm:arbitrary-messaging --data "0x48656c6c6f" --receiver YourSolanaProgramAddress --compute-units 200000
```

#### 3. Data and Tokens

Send both data and tokens in a single transaction.

```bash
yarn evm:data-and-tokens
```

**Supported Options:**

Combines options from both token transfer and arbitrary messaging scripts.

**Example:**

```bash
yarn evm:data-and-tokens \
  --token 0x779877A7B0D9E8603169DdbD7836e478b4624789 \
  --amount 1000000000000000000 \
  --data "Payment for services" \
  --receiver YourSolanaProgramAddress \
  --token-receiver YourSolanaWalletAddress
```

### Token Scripts

#### Token Faucet (Drip)

Get test tokens for development.

```bash
yarn evm:token:drip
```

**Supported Options:**

- `--chain-id <chain>` - Target chain for tokens
- `--log-level <level>` - Logging verbosity

**Example:**

```bash
# Get tokens on Base Sepolia
yarn evm:token:drip --chain-id base-sepolia
```

## Command Line Options

### Common Options

| Option | Description | Default |
|--------|-------------|---------|
| `--chain-id <chain>` | Source chain ID | ethereum-sepolia |
| `--log-level <level>` | Log verbosity (0-5) | 3 (INFO) |
| `--help, -h` | Show help information | - |

### Token Transfer Options

| Option | Description | Example |
|--------|-------------|---------|
| `--token <address>` | Single token address | 0x779877A7B0D9E8603169DdbD7836e478b4624789 |
| `--amount <amount>` | Token amount (raw units) | 1000000000000000000 |
| `--token-amounts <pairs>` | Multiple tokens | token1:amount1,token2:amount2 |
| `--fee-token <type>` | Fee token type | native, link, wrapped |
| `--token-receiver <address>` | Solana recipient | Solana wallet public key |

### Message Options

| Option | Description | Example |
|--------|-------------|---------|
| `--data <message>` | Message data | "Hello" or "0x48656c6c6f" |
| `--receiver <address>` | Message recipient | Solana program address |
| `--compute-units <units>` | Solana compute budget | 200000 |
| `--accounts <list>` | Additional accounts | addr1,addr2,addr3 |

## Usage Examples

### Basic Token Transfer

Transfer BnM tokens from Ethereum Sepolia to Solana:

```bash
# Using default configuration
yarn evm:transfer

# Using custom token and amount
yarn evm:transfer --token 0xYourTokenAddress --amount 1000000000000000000
```

### Cross-Chain Payment with Message

Send payment with invoice data:

```bash
yarn evm:data-and-tokens \
  --token 0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05 \
  --amount 10000000000000000000 \
  --data "Invoice #12345" \
  --token-receiver CustomerSolanaWallet \
  --receiver YourBusinessProgramAddress
```

### Multi-Token Transfer

Send multiple tokens in one transaction:

```bash
yarn evm:transfer --token-amounts \
  "0x779877A7B0D9E8603169DdbD7836e478b4624789:1000000000000000000,\
   0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05:5000000000000000000"
```

## Troubleshooting

### Common Issues

#### "Insufficient allowance" Error
The SDK automatically handles token approvals. If you see this error:
- Ensure you have sufficient token balance
- Check that the token address is correct
- Verify the amount includes all decimals

#### "RPC URL not set" Error
- Ensure your `.env` file exists in the project root
- Verify the RPC URL for your chosen chain is set
- Check that the RPC endpoint is accessible

#### Transaction Failures
1. **Insufficient gas**: The script estimates gas automatically, but network congestion may require manual adjustment
2. **Invalid recipient**: Ensure Solana addresses are valid public keys
3. **Token decimals**: Always use raw amounts (e.g., 1 token with 18 decimals = "1000000000000000000")

### Debug Mode

Enable detailed logging for troubleshooting:

```bash
# Maximum verbosity
yarn evm:transfer --log-level 0

# Or set in environment
export LOG_LEVEL=0
yarn evm:transfer
```

### Network-Specific Notes

- **Ethereum Sepolia**: Most reliable testnet, recommended for initial testing
- **Base Sepolia**: Fast and low-cost, good for high-volume testing  
- **Optimism Sepolia**: Similar to Base, optimistic rollup benefits
- **BSC Testnet**: Different gas token (BNB), ensure sufficient balance
- **Arbitrum Sepolia**: May have different gas estimation requirements

## See Also

- [CCIP Scripts Overview](../README.md) - General CCIP scripts documentation
- [SVM Scripts Documentation](../svm/README.md) - Solana-side operations
- [EVM SDK Documentation](../../ccip-lib/evm/README.md) - SDK implementation details
- [CCIP Explorer](https://ccip.chain.link) - Track your cross-chain messages