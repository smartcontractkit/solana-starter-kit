# CCIP EVM SDK

A TypeScript SDK for interacting with the Chainlink CCIP protocol on EVM chains.

## Installation

This SDK is part of the CCIP library and is not published as a standalone npm package. To use it:

1. Clone this repository
2. Import the modules directly from the codebase

```typescript
// Example import from local codebase
import { CCIPMessenger } from "../path/to/ccip-lib/evm";
```

## Key Features

- Cross-chain message sending with support for data and tokens
- Fee calculation for CCIP messages with various token types
- Automated token approvals for CCIP transfers
- Transaction monitoring and receipt parsing for message IDs
- Contract client wrappers for common CCIP contracts (Router, TokenPool, etc.)
- Solana-specific utilities for cross-chain communication with Solana
- Batch transaction execution for complex operations
- Structured logging with configurable log levels

## Architecture

The SDK follows a modular architecture with clear separation of concerns:

### Core Components

- **CCIPMessenger**: Main entry point for SDK functionality (fee calculation, message sending)
- **CCIPMessageFactory**: Factory for creating CCIP message requests with proper validation and formatting
- **CCIPTokenValidator**: Utilities for validating token amounts against wallet balances
- **Contract Clients**: Specialized clients for interacting with specific CCIP contracts
- **Models**: Type definitions shared across all components

### Contract Clients

- **RouterClient**: Interface to the CCIP Router contract
- **TokenAdminRegistryClient**: Interface to the TokenAdminRegistry contract
- **TokenPoolClient**: Interface to TokenPool contracts
- **ERC20Client**: Interface to ERC20 token contracts
- **BurnMintERC677HelperClient**: Utility for BurnMintERC677 token operations

### Utilities

- **Message Factory**: Factory for creating and validating CCIP message requests
- **Token Validation**: Utilities for validating token amounts and checking balances
- **Solana Utils**: Tools for encoding Solana addresses and creating Solana-specific extraArgs
- **CCIP Utils**: Helpers for message extraction and status monitoring
- **Transaction Utils**: Batch transaction execution and gas usage reporting
- **Logger**: Structured logging with configurable log levels

## Usage

### Basic Usage

```typescript
import { 
  CCIPMessenger, 
  CCIPEVMContext,
  CCIPEVMConfig,
  CCIPMessageRequest,
  LogLevel,
  createLogger 
} from "../path/to/ccip-lib/evm";
import { ethers } from "ethers";

// Create a provider with signing capabilities
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// Create the context
const context: CCIPEVMContext = {
  provider: {
    provider,
    signer,
    getAddress: async () => await signer.getAddress()
  },
  config: {
    routerAddress: "0x8A3797Be0F9782aCc1D0b6D0944077a7Ef65C72c",
    tokenAdminRegistryAddress: "0x8A3797Be0F9782aCc1D0b6D0944077a7Ef65C72d"
  },
  logger: createLogger("my-app", { level: LogLevel.INFO }),
  confirmations: 2 // Wait for 2 confirmations for transactions
};

// Create the messenger client
const messenger = new CCIPMessenger(context);

// Create a Solana-specific extraArgs for cross-chain messages to Solana
const solanaExtraArgs = messenger.createSolanaExtraArgs({
  computeUnits: 200000,
  allowOutOfOrderExecution: true
});

// Prepare a cross-chain message request
const messageRequest: CCIPMessageRequest = {
  destinationChainSelector: BigInt("16015286601757825753"), // Solana devnet
  receiver: messenger.encodeSolanaAddress("8UJgxaiQx9LHvAYV3nFecLy83dLECKSTt9Y82MuJFSWH"),
  tokenAmounts: [
    {
      token: "0x779877A7B0D9E8603169DdbD7836e478b4624789", // LINK token address
      amount: ethers.parseUnits("0.01", 18) // 0.01 LINK with 18 decimals
    }
  ],
  feeToken: "0x779877A7B0D9E8603169DdbD7836e478b4624789", // LINK token for fees
  data: "0x", // No data for token transfer only
  extraArgs: solanaExtraArgs
};

// Calculate fee first (optional)
const feeRequest = {
  destinationChainSelector: messageRequest.destinationChainSelector,
  message: {
    receiver: messageRequest.receiver,
    data: messageRequest.data,
    tokenAmounts: messageRequest.tokenAmounts,
    feeToken: messageRequest.feeToken,
    extraArgs: messageRequest.extraArgs
  }
};

const feeResult = await messenger.getFee(feeRequest);
console.log(`Estimated fee: ${ethers.formatUnits(feeResult.amount, 18)} LINK`);

// Send the message and get message ID
const result = await messenger.sendCCIPMessage(messageRequest);
console.log(`Message sent! Transaction: ${result.transactionHash}`);
console.log(`Message ID: ${result.messageId}`);
console.log(`Destination Chain Selector: ${result.destinationChainSelector}`);
console.log(`Sequence Number: ${result.sequenceNumber}`);
```

### Using the Message Factory

The `CCIPMessageFactory` provides a streamlined way to create CCIP message requests with proper validation:

```typescript
import { 
  CCIPMessageFactory, 
  CCIPMessageOptions,
  CCIPEVMContext 
} from "../path/to/ccip-lib/evm";

// Create a message for Solana with token transfer
const messageOptions: CCIPMessageOptions = {
  destinationChainSelector: BigInt("16015286601757825753"), // Solana devnet
  receiver: "8UJgxaiQx9LHvAYV3nFecLy83dLECKSTt9Y82MuJFSWH", // Solana address
  tokenAmounts: [
    {
      token: "0x779877A7B0D9E8603169DdbD7836e478b4624789", // LINK token
      amount: "10000000000000000" // 0.01 LINK with 18 decimals
    }
  ],
  feeToken: "0x779877A7B0D9E8603169DdbD7836e478b4624789", // LINK for fees
  data: "Hello Solana!", // Optional message data
  solanaParams: {
    computeUnits: 200000,
    allowOutOfOrderExecution: true,
    accountIsWritableBitmap: BigInt(2), // For message processing
    accounts: ["9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"] // Additional accounts
  }
};

// Create the message request using the factory
const messageRequest = CCIPMessageFactory.createSolanaMessage(messageOptions, logger);

// Use the created request with the messenger
const result = await messenger.sendCCIPMessage(messageRequest);
```

### Using the Token Validator

The `CCIPTokenValidator` helps validate token amounts before sending messages:

```typescript
import { 
  CCIPTokenValidator, 
  TokenAmountSpec,
  CCIPEVMContext 
} from "../path/to/ccip-lib/evm";

// Define tokens to validate
const tokenAmounts: TokenAmountSpec[] = [
  {
    token: "0x779877A7B0D9E8603169DdbD7836e478b4624789", // LINK token
    amount: "10000000000000000" // 0.01 LINK
  },
  {
    token: "0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05", // BnM token
    amount: "5000000000000000000" // 5 BnM
  }
];

// Validate token amounts and balances
const signerAddress = await signer.getAddress();
const validationResult = await CCIPTokenValidator.validateTokenAmounts(
  context, 
  signerAddress, 
  tokenAmounts
);

// Access validated amounts and token details
console.log("Validated amounts:", validationResult.validatedAmounts);
console.log("Token details:", validationResult.tokenDetails);

// Use the token details to display information to users
for (const tokenDetail of validationResult.tokenDetails) {
  console.log(`${tokenDetail.tokenSymbol}: ${ethers.formatUnits(tokenDetail.tokenBalance, tokenDetail.tokenDecimals)}`);
}
```

### Factory Functions

The SDK provides factory functions to easily create contract client instances:

```typescript
import { 
  createRouterClient,
  createTokenAdminRegistryClient,
  createTokenPoolClient,
  createERC20Client,
  createBurnMintERC677HelperClient
} from "../path/to/ccip-lib/evm";

// Create a client for the CCIP Router contract
const routerClient = createRouterClient(context);

// Create a client for an ERC20 token
const erc20Client = createERC20Client({
  ...context,
  config: {
    ...context.config,
    tokenAddress: "0x779877A7B0D9E8603169DdbD7836e478b4624789"
  }
});

// Create a client for the TokenAdminRegistry
const tokenAdminRegistryClient = createTokenAdminRegistryClient(context);

// Create a client for a specific token pool
const tokenPoolClient = createTokenPoolClient({
  ...context,
  config: {
    ...context.config,
    tokenPoolAddress: "0xA9F40983f4650AD45533F57517F8D7e722D295B9"
  }
});
```

### Solana Cross-Chain Utilities

The SDK provides specialized utilities for sending messages to Solana:

```typescript
import { createSolanaExtraArgs, encodeSolanaAddressToBytes32 } from "../path/to/ccip-lib/evm";

// Create properly formatted extraArgs for Solana messages
const extraArgs = createSolanaExtraArgs({
  computeUnits: 200000,
  allowOutOfOrderExecution: true,
  tokenReceiver: "8UJgxaiQx9LHvAYV3nFecLy83dLECKSTt9Y82MuJFSWH" // Optional override
});

// Encode a Solana address as bytes32 for the receiver field
const encodedAddress = encodeSolanaAddressToBytes32("8UJgxaiQx9LHvAYV3nFecLy83dLECKSTt9Y82MuJFSWH");
```

### Transaction Batching

For complex operations, the SDK provides batch transaction execution:

```typescript
import { executeBatch, formatBatchSummary, BatchOptions } from "../path/to/ccip-lib/evm";

// Create transaction operations
const operations = [
  {
    name: "Approve LINK",
    execute: async () => await erc20Client.approve(routerAddress, approvalAmount)
  },
  {
    name: "Send CCIP Message",
    execute: async () => await messenger.sendCCIPMessage(messageRequest)
  }
];

// Execute operations in sequence
const batchOptions: BatchOptions = {
  stopOnError: true, // Stop if any operation fails
  logProgress: true  // Log progress of each operation
};

const results = await executeBatch(operations, batchOptions);
console.log(formatBatchSummary(results));
```

### Message Status and Receipt Parsing

The SDK provides utilities for tracking message status and parsing receipts:

```typescript
import { extractCCIPMessageFromReceipt, MessageStatus, getMessageStatusString } from "../path/to/ccip-lib/evm";

// Parse a transaction receipt to extract CCIP message details
const receipt = await provider.provider.getTransactionReceipt(transactionHash);
const message = extractCCIPMessageFromReceipt(receipt);

if (message) {
  console.log(`Message ID: ${message.messageId}`);
  console.log(`Sequence Number: ${message.sequenceNumber}`);
  console.log(`Destination Chain: ${message.destChainSelector}`);
}

// Get a human-readable status string
const statusString = getMessageStatusString(MessageStatus.IN_PROGRESS);
console.log(`Message Status: ${statusString}`);
```

### Error Handling

The SDK uses standard JavaScript error handling:

```typescript
try {
  await messenger.sendCCIPMessage(messageRequest);
} catch (error) {
  if (error.message.includes("insufficient allowance")) {
    console.error("Token approval required before sending");
  } else if (error.message.includes("destination chain not supported")) {
    console.error("The specified destination chain is not supported");
  } else {
    console.error(`Error sending message: ${error.message}`);
  }
}
```

### Logging

The SDK supports structured logging with configurable log levels:

```typescript
import { createLogger, LogLevel } from "../path/to/ccip-lib/evm";

// Create a logger with custom configuration
const logger = createLogger("my-component", { 
  level: LogLevel.DEBUG,
  prefix: "CCIP-EVM"
});

// Use the logger
logger.info("Processing request", { destination: "solana" });
logger.debug("Technical details", { request: messageRequest });
logger.error("Operation failed", { error });

// Change log level at runtime
logger.setLevel(LogLevel.WARN);
``` 