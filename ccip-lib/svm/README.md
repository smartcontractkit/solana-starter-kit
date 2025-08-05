# CCIP Solana SDK

A TypeScript SDK for interacting with the Chainlink CCIP protocol on Solana.

## Installation

This SDK is part of the CCIP library and is not published as a standalone npm package. To use it:

1. Clone this repository
2. Import the modules directly from the codebase

```typescript
// Example import from local codebase
import { CCIPClient } from "../path/to/ccip-lib/svm";
```

## Key Features

- Fee calculation for CCIP messages with support for various token types
- Message sending with transaction monitoring and compute budget management
- Message ID extraction from transaction logs with event parsing
- ExtraArgs generation for cross-chain messages with customizable gas limits
- Comprehensive PDA utilities for all CCIP account types
- Anchor-generated bindings for all CCIP accounts and instructions
- Flexible configuration management with dependency injection
- Structured logging throughout the SDK
- Token pool management (burn-mint pools) for cross-chain token transfers

## Architecture

The SDK follows a modular architecture with clear separation of concerns:

### Core Components

- **CCIPClient**: Main entry point for SDK functionality (fee calculation, message sending, token pool access)
- **CCIPAccountReader**: Handles fetching and decoding on-chain CCIP accounts
- **Models**: Type definitions shared across all components

### Token Pools

- **TokenPoolClient**: Abstract interface for token pool operations
- **BurnMintTokenPoolClient**: Implementation for burn-mint token pools
- **TokenPoolFactory**: Factory for creating and detecting token pool types

### Bindings

- **Accounts**: Auto-generated Anchor bindings for all on-chain account structs
- **Instructions**: Auto-generated Anchor bindings for all on-chain instructions
- **Types**: Type definitions for core CCIP protocol data structures

### Utilities

- **SolanaAccountManager**: Utilities for managing Solana account write permissions and bitmap calculations
- **PDAs**: Comprehensive utilities for deriving all program-derived addresses
- **Logger**: Structured logging with configurable log levels
- **Conversion**: Helper functions for data type conversions
- **Error Handling**: Standardized error types and handling

## Usage

### Basic Usage

```typescript
import {
  CCIPClient,
  CCIPSendRequest,
  ExtraArgsOptions,
  CCIPContext,
  CCIPProvider,
  CCIPCoreConfig,
  LogLevel,
  createLogger,
} from "../path/to/ccip-lib/svm";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

// Create a provider (application responsibility)
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const keypair = Keypair.fromSecretKey(/* your secret key */);

const provider: CCIPProvider = {
  connection,
  wallet: keypair,
  getAddress(): PublicKey {
    return keypair.publicKey;
  },
  async signTransaction(tx) {
    if (tx instanceof VersionedTransaction) {
      tx.sign([keypair]);
    } else {
      tx.partialSign(keypair);
    }
    return tx;
  },
};

// Create configuration (application responsibility)
const config: CCIPCoreConfig = {
  ccipRouterProgramId: new PublicKey(
    "Ccip8ZTcM2qHjVt8FYHtuCAqjc637yLKnsJ5q5r2e6eL"
  ),
  feeQuoterProgramId: new PublicKey(
    "FeeQhewH1cd6ZyHqhfMiKAQntgzPT6bWwK26cJ5qSFo6"
  ),
  rmnRemoteProgramId: new PublicKey(
    "RmnAZiCJdaYtwR1f634Ba7yNJXuK3pS6kHuX4FgNgX8"
  ),
  linkTokenMint: new PublicKey("D3HCrigxfvScYyokPC1YGpNgqyheVMVwbgP7XPywvEdc"),
  tokenMint: new PublicKey("7AC59PVvR64EoMnLX45FHnJAYzPsxdViyYBsaGEQPFvh"),
  nativeSol: PublicKey.default,
  systemProgramId: new PublicKey("11111111111111111111111111111111"),
  ethereumSepoliaSelector: BigInt("16015286601757825753"),
  programId: new PublicKey("52XvWQKuZHRjnR7qHsEGE532jqgQ3MBiBMgVkBowP1LD"),
};

// Create context with provider and config
const context: CCIPContext = {
  provider,
  config,
  logger: createLogger("my-app", { level: LogLevel.INFO }),
};

// Create CCIPClient with the context
const client = new CCIPClient(context);

// Create extraArgs configuration
const extraArgsConfig: ExtraArgsOptions = {
  gasLimit: 200000,
  allowOutOfOrderExecution: true,
};

// Generate the extraArgs buffer
const extraArgs = client.createExtraArgs(extraArgsConfig);

// Create a CCIP send request
const sendRequest: CCIPSendRequest = {
  destChainSelector: new BN("16015286601757825753"),
  receiver: Buffer.from(
    "0x9d087fC03ae39b088326b67fA3C788236645b717".slice(2),
    "hex"
  ),
  data: Buffer.alloc(0), // Empty data for token transfer only
  tokenAmounts: [
    {
      token: new PublicKey("7AC59PVvR64EoMnLX45FHnJAYzPsxdViyYBsaGEQPFvh"),
      amount: new BN(10000000), // 0.01 tokens with 9 decimals
    },
  ],
  feeToken: PublicKey.default, // Use native SOL
  extraArgs: extraArgs,
};

// Calculate fee first (optional)
const feeRequest = {
  destChainSelector: sendRequest.destChainSelector,
  message: {
    receiver: sendRequest.receiver,
    data: sendRequest.data,
    tokenAmounts: sendRequest.tokenAmounts,
    feeToken: sendRequest.feeToken,
    extraArgs: extraArgs,
  },
};

const feeResult = await client.getFee(feeRequest);
console.log(`Estimated fee: ${feeResult.amount.toString()}`);

// Send the message and get message ID
const result = await client.sendWithMessageId(sendRequest);
console.log(`Message sent! Transaction: ${result.txSignature}`);
console.log(`Message ID: ${result.messageId}`);
console.log(`Destination Chain Selector: ${result.destinationChainSelector}`);
console.log(`Sequence Number: ${result.sequenceNumber}`);
```

### Using with Wallet Adapters

You can easily integrate with Solana wallet adapters:

```typescript
import {
  CCIPClient,
  CCIPContext,
  CCIPProvider,
  CCIPCoreConfig,
} from "../path/to/ccip-lib/svm";
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";

// In your React component
function MyComponent() {
  const { publicKey, signTransaction } = useWallet();
  const connection = new Connection("https://api.devnet.solana.com");

  // Create provider from wallet adapter
  const provider: CCIPProvider = {
    connection,
    wallet: null, // Not used directly with wallet adapter
    getAddress(): PublicKey {
      return publicKey;
    },
    async signTransaction(tx: Transaction | VersionedTransaction) {
      return await signTransaction(tx);
    },
  };

  // Get your config from application
  const config: CCIPCoreConfig = {
    // ...your config properties
  };

  // Create context
  const context: CCIPContext = {
    provider,
    config,
  };

  // Create client
  const client = new CCIPClient(context);

  // Use client...
}
```

### ExtraArgs Configuration

The SDK supports creating properly formatted extraArgs for CCIP messages:

```typescript
// Configure extraArgs with options
const extraArgs = client.createExtraArgs({
  gasLimit: 200000, // Gas limit for execution on destination chain
  allowOutOfOrderExecution: true, // Whether to allow out-of-order execution
});

// Or use default values
const defaultExtraArgs = client.createExtraArgs();
```

### Using the Account Reader

The CCIPAccountReader provides convenient methods to fetch and decode on-chain accounts:

```typescript
// Get the account reader from the client
const accountReader = client.getAccountReader();

// Fetch token admin registry for a token
const tokenRegistry = await accountReader.getTokenAdminRegistry(tokenMint);

// Fetch CCIP configuration
const config = await accountReader.getConfig();

// Fetch destination chain state
const destChainState = await accountReader.getDestChainState(destChainSelector);
```

## PDA Utilities

The SDK provides comprehensive utility functions for calculating Program Derived Addresses (PDAs) used throughout the CCIP protocol.

### Token Pools Signer PDAs

When delegating token authority for CCIP cross-chain transfers, it's crucial to understand that there are two different types of PDA signers:

1. `feeBillingSignerPDA` - Used for fee payments (derived with the `fee_billing_signer` seed)
2. `tokenPoolsSignerPDA` - Used for token transfers (derived with the `external_token_pools_signer` seed)

#### Important Note About Token Pool Signers

The token pool signer PDA is more complex than it initially appears. In the CCIP protocol, the actual PDA used for token transfers is derived using **both**:

1. The `external_token_pools_signer` seed
2. The pool program ID (which is specific to each token)

The pool program ID is stored in a lookup table that is part of the token admin registry for each token. This means a simple `findExternalTokenPoolsSignerPDA` function that uses only the seed is **not sufficient** for accurate delegation.

#### PDA Functions

To address this complexity, the SDK provides several functions:

```typescript
// Basic function - not sufficient for token transfers
findExternalTokenPoolsSignerPDA(programId: PublicKey): [PublicKey, number]

// Recommended - dynamically finds the correct token pool signer PDA
findDynamicTokenPoolsSignerPDA(
  mint: PublicKey,
  routerProgramId: PublicKey,
  connection: Connection
): Promise<[PublicKey, number]>

// Alternative using CCIPAccountReader
findTokenPoolsSignerWithAccountReader(
  mint: PublicKey,
  routerProgramId: PublicKey,
  accountReader: CCIPAccountReader,
  connection: Connection
): Promise<[PublicKey, number]>
```

### Other Important PDAs

The SDK provides utilities for all PDAs used in the CCIP protocol:

```typescript
// Router configuration PDA
findConfigPDA(programId: PublicKey): [PublicKey, number]

// Fee billing signer PDA (for fee payments)
findFeeBillingSignerPDA(programId: PublicKey): [PublicKey, number]

// Token admin registry PDA
findTokenAdminRegistryPDA(mint: PublicKey, programId: PublicKey): [PublicKey, number]

// Destination chain state PDA
findDestChainStatePDA(chainSelector: bigint, programId: PublicKey): [PublicKey, number]

// Nonce PDA
findNoncePDA(chainSelector: bigint, authority: PublicKey, programId: PublicKey): [PublicKey, number]

// Token pool chain config PDA
findTokenPoolChainConfigPDA(
  chainSelector: bigint,
  tokenMint: PublicKey,
  programId: PublicKey
): [PublicKey, number]
```

#### Usage for Token Delegation

When delegating token authority to the CCIP protocol, you should:

1. Use `findFeeBillingSignerPDA` for fee token delegation (e.g., SOL)
2. Use `findDynamicTokenPoolsSignerPDA` for token transfer delegation (e.g., BnM, LINK)

```typescript
// For fee token delegation (e.g., SOL)
const [feeBillingSigner] = findFeeBillingSignerPDA(routerProgramId);

// For token transfer delegation (e.g., BnM, LINK)
const [tokenPoolsSigner] = await findDynamicTokenPoolsSignerPDA(
  tokenMint,
  routerProgramId,
  connection
);
```

## Token Pool Support

The SDK provides support for interacting with different types of token pools used by CCIP for cross-chain transfers.

### Token Pool Types

Currently, the SDK supports the following pool types:

- **Burn-Mint Pools**: Tokens are burned on the source chain and minted on the destination chain.

### Using Token Pools

Token pools can be accessed through the `CCIPClient`:

```typescript
// Get a burn-mint token pool client
const burnMintPool = client.getTokenPoolClient(TokenPoolType.BURN_MINT);

// Or auto-detect the pool type for a specific token mint
const pool = await client.getTokenPoolClientForMint(tokenMint);

// Create a new pool for a token
const txSignature = await pool.createPool(tokenMint);

// Configure a chain for cross-chain transfers
const chainConfig = {
  enabled: true,
  maxTokensPerMessage: new BN(1000000000), // 1 token with 9 decimals
  feeBps: 10, // 0.1% fee
};
await pool.configureChain(tokenMint, destinationChainSelector, chainConfig);

// Set rate limits for a token
await pool.setRateLimit(
  tokenMint,
  new BN(1000000000), // Capacity: 1 token with 9 decimals
  new BN(100000000) // Rate: 0.1 tokens per second
);

// Transfer admin role for a token pool
await pool.transferAdminRole(tokenMint, newAdminPublicKey);
```

### Token Pool Factory

For advanced usage, you can use the `TokenPoolFactory` directly:

```typescript
import { TokenPoolFactory, TokenPoolType } from "../path/to/ccip-lib/svm";

// Create a specific token pool type
const pool = TokenPoolFactory.create(TokenPoolType.BURN_MINT, context);

// Auto-detect the token pool type for a mint
const poolType = await TokenPoolFactory.detectPoolType(tokenMint, context);
const pool = TokenPoolFactory.create(poolType, context);
```

### PDA Utilities for Token Pools

The SDK provides functions to derive all program-derived addresses used in token pools:

```typescript
import {
  findBurnMintPoolConfigPDA,
  findBurnMintPoolChainConfigPDA,
  findRateLimitPDA,
} from "../path/to/ccip-lib/svm";

// Get the pool config PDA
const [poolConfigPDA] = findBurnMintPoolConfigPDA(
  tokenMint,
  burnMintPoolProgramId
);

// Get the chain config PDA
const [chainConfigPDA] = findBurnMintPoolChainConfigPDA(
  chainSelector,
  tokenMint,
  burnMintPoolProgramId
);

// Get the rate limit PDA
const [rateLimitPDA] = findRateLimitPDA(tokenMint, burnMintPoolProgramId);
```

## Error Handling

The SDK uses standardized error handling with custom error types:

```typescript
import {
  CCIPError,
  CCIPTransactionError,
  CCIPAccountError,
} from "../path/to/ccip-lib/svm";

try {
  await client.sendWithMessageId(sendRequest);
} catch (error) {
  if (error instanceof CCIPTransactionError) {
    console.error(`Transaction failed: ${error.message}`, error.txSignature);
  } else if (error instanceof CCIPAccountError) {
    console.error(`Account error: ${error.message}`, error.account);
  } else if (error instanceof CCIPError) {
    console.error(`CCIP error: ${error.message}`);
  } else {
    console.error(`Unknown error: ${error}`);
  }
}
```

## Logging

The SDK supports structured logging with configurable log levels:

```typescript
import { createLogger, LogLevel } from "../path/to/ccip-lib/svm";

// Create a logger with custom configuration
const logger = createLogger("my-component", {
  level: LogLevel.DEBUG,
  pretty: true, // For human-readable logs
  skipTimestamp: false, // Include timestamps
});

// Use the logger
logger.info("Processing request", { destination: "ethereum" });
logger.debug("Technical details", { request: sendRequest });
logger.error("Operation failed", { error });

// Change log level at runtime
logger.setLevel(LogLevel.WARN);
```

### Using the Solana Account Manager

The `SolanaAccountManager` provides utilities for managing Solana account write permissions and bitmap calculations used in CCIP messages:

```typescript
import { 
  SolanaAccountManager, 
  AccountSpec 
} from "../path/to/ccip-lib/svm";

// Define account specifications for a CCIP message
const accounts: AccountSpec[] = [
  {
    publicKey: "11111111111111111111111111111111", // State PDA
    isWritable: false // Read-only
  },
  {
    publicKey: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // Messages storage PDA
    isWritable: true // Writable
  },
  {
    publicKey: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", // Token mint
    isWritable: true // Writable
  }
];

// Calculate the writable bitmap from account specifications
const bitmap = SolanaAccountManager.calculateWritableBitmap(accounts);
console.log(`Writable bitmap: ${bitmap} (binary: ${bitmap.toString(2)})`);
// Output: Writable bitmap: 6 (binary: 110)

// Create bitmap from boolean flags (alternative approach)
const writableFlags = [false, true, true]; // [readonly, writable, writable]
const bitmapFromFlags = SolanaAccountManager.createBitmapFromFlags(writableFlags);
console.log(`Bitmap from flags: ${bitmapFromFlags}`); // Output: 6

// Get human-readable explanation of a bitmap
const explanation = SolanaAccountManager.explainBitmap(BigInt(46), 7);
console.log("Bitmap explanation:", explanation);
/* Output:
{
  binary: "0101110",
  decimal: 46,
  accounts: [
    { index: 0, writable: false },
    { index: 1, writable: true },
    { index: 2, writable: true },
    { index: 3, writable: true },
    { index: 4, writable: false },
    { index: 5, writable: true },
    { index: 6, writable: false }
  ]
}
*/

// Validate that a bitmap is appropriate for the number of accounts
try {
  SolanaAccountManager.validateBitmap(BigInt(46), 7); // Valid
  console.log("Bitmap is valid for 7 accounts");
} catch (error) {
  console.error(`Invalid bitmap: ${error.message}`);
}

// Example: Invalid bitmap for account count
try {
  SolanaAccountManager.validateBitmap(BigInt(255), 3); // Invalid - bitmap too large
} catch (error) {
  console.error(`Invalid bitmap: ${error.message}`);
  // Output: Invalid bitmap: Invalid bitmap 255 for 3 accounts. Maximum valid bitmap is 7 (binary: 111)
}
```

#### Common CCIP Bitmap Patterns

The SDK makes it easy to work with common CCIP bitmap patterns:

```typescript
// For arbitrary messaging (2 accounts: state, message_storage)
const messagingAccounts: AccountSpec[] = [
  { publicKey: "state_pda_address", isWritable: false },      // bit 0 = 0
  { publicKey: "message_storage_pda", isWritable: true }      // bit 1 = 1
];
const messagingBitmap = SolanaAccountManager.calculateWritableBitmap(messagingAccounts);
// Result: 2 (binary: 10)

// For data and tokens (7 accounts with specific write permissions)
const dataTokensAccounts: AccountSpec[] = [
  { publicKey: "state_pda", isWritable: false },              // bit 0 = 0
  { publicKey: "message_storage_pda", isWritable: true },     // bit 1 = 1
  { publicKey: "token_mint", isWritable: true },              // bit 2 = 1
  { publicKey: "source_token_account", isWritable: true },    // bit 3 = 1
  { publicKey: "token_admin_pda", isWritable: false },        // bit 4 = 0
  { publicKey: "recipient_token_account", isWritable: true }, // bit 5 = 1
  { publicKey: "token_program", isWritable: false }           // bit 6 = 0
];
const dataTokensBitmap = SolanaAccountManager.calculateWritableBitmap(dataTokensAccounts);
// Result: 46 (binary: 0101110)

// Verify the calculation
const verification = SolanaAccountManager.explainBitmap(dataTokensBitmap, 7);
console.log("Data and tokens bitmap breakdown:", verification.accounts);
```

## Token Administration

The CCIP SDK works in conjunction with command-line scripts for complete token administration and registration for cross-chain transfers.

### Overview

To enable a token for CCIP cross-chain transfers, you need to follow a multi-step process:

1. **Propose Administrator**: Set up admin permissions for a token
2. **Accept Admin Role**: Complete the administrator transfer
3. **Create ALT**: Create an Address Lookup Table with required accounts
4. **Set Pool**: Register the ALT with the token to enable CCIP
5. **Inspect Token**: Validate configuration against existing tokens

### Command-Line Scripts

For detailed instructions on each step, including all options, security considerations, and examples, see the comprehensive **[CCIP Scripts Documentation](../ccip-scripts/svm/README.md#3-token-admin-registry-management)**.

#### Quick Reference

```bash
# Step 1: Propose administrator (as mint authority)
yarn svm:admin:propose-administrator --token-mint <TOKEN_MINT>

# Step 2: Accept admin role (as proposed administrator)
yarn svm:admin:accept-admin-role --token-mint <TOKEN_MINT>

# Step 3: Create ALT (anyone can pay for creation)
yarn svm:admin:create-alt --token-mint <TOKEN_MINT> --pool-program <POOL_PROGRAM>

# Step 3a: Create ALT with additional custom addresses (optional)
yarn svm:admin:create-alt --token-mint <TOKEN_MINT> --pool-program <POOL_PROGRAM> --additional-addresses <ADDRESS1,ADDRESS2>

# Step 4: Set pool (as administrator)
yarn svm:admin:set-pool --token-mint <TOKEN_MINT> --lookup-table <ALT_ADDRESS> --writable-indices 3,4,7

# Step 5: Verify configuration
yarn svm:admin:inspect-token --token-mint <TOKEN_MINT>
```

### Writable Indices Pattern

The writable indices vary based on the token pool type:

#### **Burn-Mint Tokens (Most Common): [3, 4, 7]**

- **Index 3**: Pool Configuration PDA (sequence numbers, rate limits)
- **Index 4**: Pool Token Account (token balance changes)
- **Index 7**: Token Mint (supply changes during burn/mint operations)

#### **Lock-Release Tokens: [3, 4, 5]**

- **Index 3**: Pool Configuration PDA (sequence numbers, rate limits)
- **Index 4**: Pool Token Account (token balance changes)
- **Index 5**: Pool Signer PDA (authorizes transfers, may pay fees)

### Programmatic Usage

For programmatic token administration using the SDK, you can work with the underlying components:

```typescript
// Access token admin registry
const registry = await client
  .getAccountReader()
  .getTokenAdminRegistry(tokenMint);

// Get token pool for a mint
const pool = await client.getTokenPoolClientForMint(tokenMint);

// Check if token is configured for CCIP
const isConfigured = registry.lookupTable !== PublicKey.default;
```

### Integration with Scripts

The SDK complements the command-line scripts by providing the underlying functionality. While scripts handle the setup and configuration, the SDK enables programmatic interaction with configured tokens for cross-chain operations.
