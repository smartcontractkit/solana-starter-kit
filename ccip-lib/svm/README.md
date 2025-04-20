# CCIP Solana SDK

A TypeScript SDK for interacting with the Chainlink CCIP protocol on Solana.

## Installation

```bash
npm install --save ccip-solana-sdk
```

## Key Features

- Fee calculation for CCIP messages
- Message sending with transaction monitoring
- Message ID extraction from transaction results
- ExtraArgs generation for cross-chain messages
- Flexible configuration management 
- Dependency injection for better testability

## Architecture

The SDK follows a dependency injection pattern that allows flexible configuration and easier testing:

- **Decoupled Configuration**: Configuration is provided by the client, not hardcoded in the SDK
- **Provider Abstraction**: Wallet and connection details are abstracted behind providers
- **Context Pattern**: Single context object passed to all functions 
- **Logger Integration**: Structured logging throughout the SDK
- **Client-Side Provider Management**: The SDK doesn't handle keypairs or wallet connections directly

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
  createLogger
} from "ccip-solana-sdk";
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
  }
};

// Create configuration (application responsibility)
const config: CCIPCoreConfig = {
  ccipRouterProgramId: new PublicKey("Ccip8ZTcM2qHjVt8FYHtuCAqjc637yLKnsJ5q5r2e6eL"),
  feeQuoterProgramId: new PublicKey("FeeQhewH1cd6ZyHqhfMiKAQntgzPT6bWwK26cJ5qSFo6"),
  rmnRemoteProgramId: new PublicKey("RmnAZiCJdaYtwR1f634Ba7yNJXuK3pS6kHuX4FgNgX8"),
  linkTokenMint: new PublicKey("D3HCrigxfvScYyokPC1YGpNgqyheVMVwbgP7XPywvEdc"),
  tokenMint: new PublicKey("7AC59PVvR64EoMnLX45FHnJAYzPsxdViyYBsaGEQPFvh"),
  nativeSol: PublicKey.default,
  systemProgramId: new PublicKey("11111111111111111111111111111111"),
  ethereumSepoliaSelector: BigInt("16015286601757825753"),
  programId: new PublicKey("52XvWQKuZHRjnR7qHsEGE532jqgQ3MBiBMgVkBowP1LD")
};

// Create context with provider and config
const context: CCIPContext = {
  provider,
  config,
  logger: createLogger("my-app", { level: LogLevel.INFO })
};

// Create CCIPClient with the context
const client = new CCIPClient(context);

// Create extraArgs configuration
const extraArgsConfig: ExtraArgsOptions = {
  gasLimit: 200000,
  allowOutOfOrderExecution: true
};

// Generate the extraArgs buffer
const extraArgs = client.createExtraArgs(extraArgsConfig);

// Create a CCIP send request
const sendRequest: CCIPSendRequest = {
  destChainSelector: new BN("16015286601757825753"),
  receiver: Buffer.from("0x9d087fC03ae39b088326b67fA3C788236645b717".slice(2), "hex"), 
  data: Buffer.alloc(0), // Empty data for token transfer only
  tokenAmounts: [
    {
      token: new PublicKey("7AC59PVvR64EoMnLX45FHnJAYzPsxdViyYBsaGEQPFvh"),
      amount: new BN(10000000), // 0.01 tokens with 9 decimals
    },
  ],
  feeToken: PublicKey.default, // Use native SOL
  extraArgs: extraArgs
};

// Calculate fee first (optional)
const feeRequest = {
  destChainSelector: sendRequest.destChainSelector,
  message: {
    receiver: sendRequest.receiver,
    data: sendRequest.data,
    tokenAmounts: sendRequest.tokenAmounts,
    feeToken: sendRequest.feeToken,
    extraArgs: extraArgs
  }
};

const feeResult = await client.getFee(feeRequest);
console.log(`Estimated fee: ${feeResult.amount.toString()}`);

// Send the message and get message ID
const result = await client.sendWithMessageId(sendRequest);
console.log(`Message sent! Transaction: ${result.txSignature}`);
console.log(`Message ID: ${result.messageId}`);
```

### Using with Wallet Adapters

You can easily integrate with Solana wallet adapters:

```typescript
import { 
  CCIPClient, 
  CCIPContext, 
  CCIPProvider,
  CCIPCoreConfig
} from "ccip-solana-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
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
    async signTransaction(tx) {
      return await signTransaction(tx);
    }
  };

  // Get your config from application
  const config: CCIPCoreConfig = {
    // ...your config properties
  };

  // Create context
  const context: CCIPContext = {
    provider,
    config: config
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
  allowOutOfOrderExecution: true // Whether to allow out-of-order execution
});

// Or use default values
const defaultExtraArgs = client.createExtraArgs();
```

## PDA Utilities

The SDK provides utility functions for calculating Program Derived Addresses (PDAs) used throughout the CCIP protocol.

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

#### Usage for Token Delegation

When delegating token authority to the CCIP protocol, you should:

1. Use `findFeeBillingSignerPDA` for fee token delegation (e.g., wSOL)
2. Use `findDynamicTokenPoolsSignerPDA` or `findTokenPoolsSignerWithAccountReader` for token transfer delegation (e.g., BnM, LINK)

See the `scripts/token/delegate-token-authority.ts` script for a complete example.

## Examples

For complete examples, see the `examples` and `scripts` directories:

- Fee calculation with token-specific details
- Message sending with compute budget instructions
- Event parsing and monitoring
- Custom error handling

## Contributing

Contributions are welcome! Please see CONTRIBUTING.md for details.

## License

[MIT](LICENSE)