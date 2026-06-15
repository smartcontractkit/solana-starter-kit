# Solana CCIP Scripts - Technical Documentation

This is the technical guide for Solana CCIP messaging, transfer, delegation, and receiver scripts. Each script includes detailed usage instructions, options, examples, and troubleshooting guidance.

> 📖 **This is the detailed technical reference for SVM operations**  
> For overview and quick start: [Main README](../README.md)

## Prerequisites

- Node.js v20+ (v23.11.0 recommended)
- Yarn
- Solana CLI tools
- A wallet with SOL on Devnet for testing
- `.config/solana/id.json` keypair used by default
- Optional: `.config/solana/keytest.json` for test operations

## Getting Started

Before running any scripts, ensure you have installed all dependencies:

```bash
yarn install
```

## Available Scripts

> **Cross-chain token (CCT) setup** (token pools, admin registry, ALT management) has moved to [ccip-solana-bs58-generator](https://github.com/smartcontractkit/ccip-solana-bs58-generator). This guide covers messaging, transfers, delegation, and receiver scripts only.

### 1. Token Preparation Scripts

#### 1.1. Wrap SOL to wSOL

The `wrap-sol.ts` script allows you to wrap native SOL into wrapped SOL (wSOL) tokens.

```bash
# Use default keypair
yarn svm:token:wrap

# Specify amount of SOL to wrap
yarn svm:token:wrap -- --amount 2

# Use test keypair (if configured)
yarn svm:token:wrap -- --use-test-keypair
```

The script:

- Checks your SOL balance
- Wraps the specified amount (1 SOL by default) into wSOL
- Displays before and after balances

#### 1.2. Delegate Token Authority

The `delegate-token-authority.ts` script delegates token spending authority to the CCIP router's Program Derived Addresses (PDAs).

```bash
# Use default keypair
yarn svm:token:delegate

# Use test keypair (if configured)
yarn svm:token:delegate -- --use-test-keypair
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

The `check-token-approval.ts` script checks the current delegation status of your token accounts.

```bash
# Use default keypair
yarn svm:token:check

# Use test keypair (if configured)
yarn svm:token:check -- --use-test-keypair
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

### 2. CCIP Receiver Management

The receiver scripts allow you to deploy and manage CCIP receiver programs that can process incoming cross-chain messages. These are essential for building applications that receive data or tokens from other chains.

#### 2.1. Deploy Receiver Program

The `deploy.ts` script deploys a new CCIP receiver program to handle incoming cross-chain messages.

```bash
# Deploy a new CCIP receiver program
yarn svm:receiver:deploy

# With debug logging
yarn svm:receiver:deploy -- --log-level DEBUG
```

This script:

- Deploys a new receiver program instance
- Sets up the program for incoming CCIP messages
- Returns the program ID for use in initialization

#### 2.2. Initialize Receiver

The `initialize.ts` script initializes a receiver program to start accepting incoming CCIP messages.

```bash
# Initialize receiver for incoming messages
yarn svm:receiver:initialize

# With debug logging
yarn svm:receiver:initialize -- --log-level DEBUG
```

This script:

- Sets up the receiver state account
- Configures the receiver for CCIP message processing
- Prepares storage for incoming message data

#### 2.3. Get Latest Message

The `get-latest-message.ts` script retrieves the latest received cross-chain message from the receiver.

```bash
# Get the latest received message
yarn svm:receiver:get-message

# With debug logging
yarn svm:receiver:get-message -- --log-level DEBUG
```

This script:

- Fetches the most recent incoming message
- Displays message content and metadata
- Shows sender information and chain details

#### 2.4. Close Receiver Storage

The `close-storage.ts` script closes receiver storage accounts to reclaim rent fees.

```bash
# Close receiver storage accounts
yarn svm:receiver:close

# With debug logging
yarn svm:receiver:close -- --log-level DEBUG
```

This script:

- Closes storage accounts when no longer needed
- Reclaims rent fees to the wallet
- Properly cleans up receiver state

**Prerequisites for Receiver Operations:**

- Wallet must have sufficient SOL balance for account creation and rent
- Receiver program must be deployed before initialization
- Initialization must complete before processing messages

### 3. Get CCIP Fee Estimations

The `get-ccip-fee.ts` script provides fee estimations for cross-chain message delivery using CCIP.

#### Usage

You can run the script with Yarn:

```bash
yarn svm:fee [options]
```

Or using ts-node directly:

```bash
yarn ts-node ccip-scripts/svm/router/get-ccip-fee.ts [options]
```

#### Options

- `--network <devnet|mainnet>`: Specify network (default: devnet)
- `--keypair <path>`: Path to keypair file (default: ~/.config/solana/id.json)
- `--use-test-keypair`: Use test keypair at ~/.config/solana/keytest.json
- `--log-level <level>`: Set logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip preflight transaction checks
- `--help` or `-h`: Show usage information

#### Examples

Basic usage with default settings:

```bash
yarn svm:fee
```

With increased log level for debugging:

```bash
yarn svm:fee -- --log-level DEBUG
```

Maximum logging for troubleshooting:

```bash
yarn svm:fee -- --log-level TRACE
```

Using test keypair:

```bash
yarn svm:fee -- --use-test-keypair
```

Skip preflight checks:

```bash
yarn svm:fee -- --skip-preflight
```

#### Fee Token Options

The script uses Wrapped SOL (wSOL) for fee estimations. This is configured in the script to ensure consistent fee calculation with the Solana CCIP implementation.

### 4. Send CCIP Cross-Chain Messages

The router scripts in `ccip-scripts/svm/router/` send messages from Solana to EVM chains using Chainlink's CCIP router.

**⚠️ PREREQUISITES:**

1. Run `yarn svm:token:delegate` before token transfers or non-native fee tokens (LINK, wSOL)
2. Ensure you have sufficient SOL for transaction fees
3. Ensure you have sufficient tokens to transfer

#### Usage

Router scripts for different cross-chain operations:

```bash
# Token transfers between chains
yarn svm:token-transfer

# Send arbitrary messages
yarn svm:arbitrary-messaging

# Send both data and tokens
yarn svm:data-and-tokens

# With debug logging (add to any script)
yarn svm:token-transfer -- --log-level DEBUG

# Using test keypair (add to any script)
yarn svm:token-transfer -- --use-test-keypair

# Skip preflight checks (add to any script)
yarn svm:token-transfer -- --skip-preflight
```

Or you can use ts-node directly:

```bash
yarn ts-node ccip-scripts/svm/router/1_token-transfer.ts [options]
yarn ts-node ccip-scripts/svm/router/2_arbitrary-messaging.ts [options]
yarn ts-node ccip-scripts/svm/router/3_data-and-tokens.ts [options]
```

#### Options

- `--network <devnet|mainnet>`: Specify network (default: devnet)
- `--keypair <path>`: Path to keypair file (default: ~/.config/solana/id.json)
- `--use-test-keypair`: Use test keypair at ~/.config/solana/keytest.json
- `--fee-token <token>`: Specify which token to use for paying CCIP fees:
  - `native`: Native SOL (default)
  - `wrapped-native`: Wrapped SOL (WSOL)
  - `link`: Chainlink's LINK token
  - `<ADDRESS>`: Custom token address
- `--log-level <level>`: Set logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip the preflight transaction check (useful for complex transactions)
- `--help` or `-h`: Show usage information

#### Examples

Send tokens between chains:

```bash
yarn svm:token-transfer
```

Send arbitrary messages:

```bash
yarn svm:arbitrary-messaging
```

Send both data and tokens:

```bash
yarn svm:data-and-tokens
```

Send with detailed logging:

```bash
yarn svm:token-transfer -- --log-level DEBUG
```

Send with test keypair:

```bash
yarn svm:token-transfer -- --use-test-keypair
```

Send with custom keypair:

```bash
yarn svm:token-transfer -- --keypair /path/to/keypair.json
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

Open the CCIP explorer: https://ccip.chain.link/msg/0x3a4e9844d472c33a3edb27bc2a4215bc8f4b3b7c2822c2dd8d4e12ad9cbacf13

View transaction on explorer:
https://explorer.solana.com/tx/3pVb8ifuASvwB3ziqGhYtNrtoYkcqmwJVQQygaAcAP9bY94KRbu5F7173tediMcrLHUKmwu6Ust3NvnAujPTvkSk?cluster=devnet
```

### Keypair Handling

The scripts use the following approach for keypair selection:

1. **Default Behavior**: Uses the standard Solana keypair at `~/.config/solana/id.json`
2. **Custom Keypair**: Specify a custom path with `--keypair <path>`
3. **Test Keypair**: Use the test keypair at `~/.config/solana/keytest.json` with the `--use-test-keypair` flag

### Configuration

The scripts use configuration from `ccip-scripts/config/index.ts` which provides network endpoints and contract addresses.

### Troubleshooting

If you encounter errors:

1. Ensure your wallet has sufficient SOL balance
2. Check that you're connected to the correct network (devnet)
3. Verify your keypair is correctly loaded
4. Increase the log level to DEBUG or TRACE for more information
   ```bash
   yarn svm:fee -- --log-level TRACE
   ```

#### Skip Preflight Option

If you encounter issues with transaction simulation failing, you can use the `--skip-preflight` option:

```bash
yarn svm:token-transfer -- --skip-preflight
# or
yarn svm:fee -- --skip-preflight
```

This bypasses the client-side simulation that happens before sending the transaction, which can be useful for complex transactions that might exceed compute limits during simulation but would work when executed on-chain.

#### Fee Token Recommendations

Based on our testing:

1. **Wrapped SOL** (`--fee-token wrapped-native`): Most reliable option for paying fees
2. **Native SOL** (default): Works in most cases but may have issues with complex transactions
3. **LINK** (`--fee-token link`): Requires having LINK tokens in your wallet and proper delegations

#### Permission Errors

If you see errors like "owner does not match" or permission-related errors:

1. **Make sure** you've run `yarn svm:token:delegate` to grant the necessary permissions
2. Run `yarn svm:token:check` to verify delegations are correctly set
3. If using a non-native fee token, verify it has been delegated to the Fee Billing Signer

#### Common Fee Token Issues

- **Insufficient balance**: Ensure you have enough of the selected fee token
- **Token account not found**: When using tokens other than native SOL, you must have an associated token account
- **Invalid token mint**: Verify the token mint address is correct for the current network

## License

This project is licensed under MIT - see the LICENSE file for details.
