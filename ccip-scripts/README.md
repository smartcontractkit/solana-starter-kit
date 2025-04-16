# CCIP Scripts for Solana

This directory contains scripts for interacting with the Cross-Chain Interoperability Protocol (CCIP) on Solana. These tools help you estimate fees and send cross-chain messages using Chainlink's CCIP infrastructure.

## Prerequisites

- Node.js v20+ (v23.11.0 recommended)
- Yarn
- Solana CLI tools
- A wallet with SOL on Devnet for testing
- `.config/solana/keytest.json` keypair (used by default in these scripts)

## Getting Started

Before running any scripts, ensure you have installed all dependencies:

```bash
yarn install
```

## Available Scripts

### 1. Token Management Scripts

**⚠️ IMPORTANT:** Running the token delegation script is a prerequisite for CCIP cross-chain transfers. You must delegate authority to the CCIP router before you can send tokens or pay fees with tokens other than native SOL.

#### 1.1. Wrap SOL to wSOL

The `wrap-sol.ts` script allows you to wrap native SOL into wrapped SOL (wSOL) tokens.

```bash
yarn token:wrap
```

The script:
- Checks your SOL balance
- Wraps a predefined amount (1 SOL by default) into wSOL
- Displays before and after balances

#### 1.2. Delegate Token Authority

The `delegate-token-authority.ts` script delegates token spending authority to the CCIP router's Program Derived Addresses (PDAs).

```bash
yarn token:delegate
```

This script:
- Delegates wSOL to the Fee Billing Signer PDA
- Delegates BnM tokens to the BnM Token Pool Signer PDA
- Delegates LINK tokens to the Fee Billing Signer PDA

**These delegations are necessary for:**
1. Transferring tokens cross-chain via CCIP
2. Using non-native tokens (like wSOL or LINK) to pay for CCIP fees

If you skip this step, your transfers will fail with permission errors.

#### 1.3. Check Token Approvals

The `check-token-approvals.ts` script checks the current delegation status of your token accounts.

```bash
yarn token:check
```

This script:
- Displays token balances
- Shows which addresses have delegation authority
- Shows how many tokens are delegated

Example output:
```
==== Summary ====
Mint | Token Account | Balance | Delegate | Delegated Amount
-----|--------------|---------|----------|-----------------
So111111... | aVmjJoty... | 2000009520 | 2bsR7jPW... | 18446744073709551615
7AC59PVv... | HWFMEkEa... | 10710000000 | BKy8ADoK... | 18446744073709551615
D3HCrigx... | 8U9xkMZU... | 0 | 2bsR7jPW... | 18446744073709551615
```

### 2. Get CCIP Fee Estimations

The `get-ccip-fee.ts` script provides fee estimations for cross-chain message delivery using CCIP.

#### Usage

You can run the script with Yarn:

```bash
yarn ccip:fee [options]
```

Or using ts-node directly:

```bash
yarn ts-node ccip-scripts/router/get-ccip-fee.ts [options]
```

#### Options

- `--log-level LEVEL`: Set logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--help` or `-h`: Show usage information

#### Examples

Basic usage with default settings:
```bash
yarn ccip:fee
```

With increased log level for debugging:
```bash
yarn ccip:fee:debug
```

Maximum logging for troubleshooting:
```bash
yarn ccip:fee:trace
```

#### Fee Token Options

By default, the script uses Native SOL for fee payments. The script supports several token options for fee payment:

1. **Native SOL**: Uses the default Solana system program (PublicKey.default)
2. **Wrapped SOL**: Uses the Solana SPL Token program's NATIVE_MINT
3. **LINK Token**: Uses the Chainlink token on Solana (available on devnet)
4. **Custom Tokens**: You can specify any SPL token mint address

The fee token is configured in the script and can be viewed in the output under "Fee Token".

### 3. Send CCIP Cross-Chain Messages

The `ccip-send.ts` script sends tokens from Solana to Ethereum using Chainlink's CCIP router.

**⚠️ PREREQUISITES:**
1. For non-native fee tokens (LINK, wSOL): Run `yarn token:delegate` first
2. For token transfers: Run `yarn token:delegate` first
3. Ensure you have sufficient SOL for transaction fees
4. Ensure you have sufficient tokens to transfer

#### Usage

We provide several preconfigured commands for different fee token options:

```bash
# Using native SOL as fee token (default)
yarn ccip:send

# Using wrapped SOL as fee token
yarn ccip:send:wrapped

# Using LINK token as fee token
yarn ccip:send:link

# With debug logging
yarn ccip:send:debug
```

Or you can use with custom options:

```bash
yarn ts-node ccip-scripts/router/ccip-send.ts [options]
```

#### Options

- `--fee-token TOKEN`: Specify which token to use for paying CCIP fees:
  - `native`: Native SOL (default)
  - `wrapped-native`: Wrapped SOL (WSOL)
  - `link`: Chainlink's LINK token
  - `<ADDRESS>`: Custom token address

- `--log-level LEVEL`: Set logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip the preflight transaction check (useful for complex transactions)
- `--help` or `-h`: Show usage information

#### Examples

Send with native SOL as the fee token (default):
```bash
yarn ccip:send
```

Send using LINK as the fee token:
```bash
yarn ccip:send:link
```

Send using wrapped SOL as the fee token:
```bash
yarn ccip:send:wrapped
```

Send with detailed logging:
```bash
yarn ccip:send:debug
```

#### Process Overview

The script:
1. Loads wallet and checks balances
2. Checks token accounts and delegations
3. Calculates CCIP fees
4. Constructs and sends the cross-chain message
5. Returns message ID and transaction details

#### Expected Output

```
==== CCIP Message Sent ====
Transaction signature: 3pVb8ifuASvwB3ziqGhYtNrtoYkcqmwJVQQygaAcAP9bY94KRbu5F7173tediMcrLHUKmwu6Ust3NvnAujPTvkSk
Message ID: 0x3a4e9844d472c33a3edb27bc2a4215bc8f4b3b7c2822c2dd8d4e12ad9cbacf13

Open the CCIP explorer: https://ccip-ui-staging.vercel.app/msg/0x3a4e9844d472c33a3edb27bc2a4215bc8f4b3b7c2822c2dd8d4e12ad9cbacf13

View transaction on explorer:
https://explorer.solana.com/tx/3pVb8ifuASvwB3ziqGhYtNrtoYkcqmwJVQQygaAcAP9bY94KRbu5F7173tediMcrLHUKmwu6Ust3NvnAujPTvkSk?cluster=devnet
```

### Configuration

The scripts use configuration from `ccip-scripts/config/index.ts` which provides network endpoints and contract addresses.

### Troubleshooting

If you encounter errors:

1. Ensure your wallet has sufficient SOL balance
2. Check that you're connected to the correct network (devnet)
3. Verify your keypair is correctly loaded
4. Increase the log level to DEBUG or TRACE for more information
   ```bash
   yarn ccip:fee:trace
   ```

#### Permission Errors

If you see errors like "owner does not match" or permission-related errors:
1. **Make sure** you've run `yarn token:delegate` to grant the necessary permissions
2. Run `yarn token:check` to verify delegations are correctly set
3. If using a non-native fee token, verify it has been delegated to the Fee Billing Signer

#### Common Fee Token Issues

- **Insufficient balance**: Ensure you have enough of the selected fee token
- **Token account not found**: When using tokens other than native SOL, you must have an associated token account
- **Invalid token mint**: Verify the token mint address is correct for the current network

## License

This project is licensed under MIT - see the LICENSE file for details. 