<br/>
<p align="center">
<a href="https://chain.link" target="_blank">
<img src="./solana_logo.png" width="225" alt="Chainlink Solana logo">
</a>
</p>
<br/>

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/smartcontractkit/solana-starter-kit)

# Chainlink Solana Starter Kit

Welcome to the Chainlink Solana Starter Kit! This comprehensive toolkit demonstrates how to build cross-chain applications using Chainlink's services on Solana.

## What You'll Learn and Build

By completing this starter kit, you will:

1. **Set up a complete Solana development environment** with all necessary tools and dependencies
2. **Deploy and interact with Chainlink Data Feeds** to fetch real-world price data directly in your Solana programs
3. **Build cross-chain applications using CCIP** (Cross-Chain Interoperability Protocol) to send tokens and messages between Solana and EVM chains like Ethereum
4. **Deploy a CCIP receiver program** that can accept cross-chain messages and tokens from other blockchains

## Environment Variables

The following environment variables must be set before running the scripts:

| Variable          | Description                                                        | Required For                   |
| ----------------- | ------------------------------------------------------------------ | ------------------------------ |
| `EVM_PRIVATE_KEY` | The private key for the EVM account                                | All EVM chain operations       |
| `EVM_RPC_URL`     | RPC URL for Ethereum Sepolia                                       | Operations on Ethereum Sepolia |
| `AVAX_RPC_URL`    | RPC URL for Avalanche Fuji                                         | Operations on Avalanche Fuji   |
| `SOLANA_RPC_URL`  | RPC URL for Solana Devnet (defaults to public endpoint if not set) | Operations on Solana Devnet    |

### Setting up Environment Variables

Create a `.env` file in the root directory with the following format:

```
EVM_PRIVATE_KEY=your_private_key_here
EVM_RPC_URL=https://your-ethereum-sepolia-rpc-url
AVAX_RPC_URL=https://your-avalanche-fuji-rpc-url
SOLANA_RPC_URL=https://your-solana-devnet-rpc-url
```

**Important**: The RPC URLs must be valid and accessible for the scripts to work. If an RPC URL is not provided for a chain, an error will be thrown when attempting to use that chain.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+** - [Download here](https://nodejs.org/)
- **Rust 1.87+** - [Install here](https://www.rust-lang.org/tools/install)
- **Solana CLI v1.18.17+** - [Install here](https://docs.solanalabs.com/cli/install)
- **Anchor v0.31.1+** - [Install here](https://book.anchor-lang.com/getting_started/installation.html)
- **A C compiler** (included with GCC) - [Install here](https://gcc.gnu.org/install/)

**Note for Apple M1 users**: Install Anchor manually from source:

```bash
cargo install --git https://github.com/coral-xyz/anchor --tag v0.31.1 anchor-cli --locked
```

## Quick Start

### 1. Initial Setup

Clone the repository and navigate to the project directory:

```bash
git clone https://github.com/smartcontractkit/solana-starter-kit
cd solana-starter-kit
```

Install all dependencies:

```bash
yarn install
```

### 2. Environment Configuration

Create a `.env` file in the root directory with your configuration:

```bash
cp .env.example .env
```

Edit the `.env` file with your RPC URLs and private keys:

```env
# Required for EVM operations (Ethereum, Avalanche)
EVM_PRIVATE_KEY=your_private_key_here
EVM_RPC_URL=https://your-ethereum-sepolia-rpc-url
AVAX_RPC_URL=https://your-avalanche-fuji-rpc-url

# Optional - defaults to public endpoint if not set
SOLANA_RPC_URL=https://your-solana-devnet-rpc-url
```

### 3. Wallet Setup

Generate a new Solana wallet (or use existing one):

```bash
solana-keygen new -o id.json
```

Fund your wallet with SOL for transaction fees:

```bash
solana airdrop 5 $(solana-keygen pubkey id.json) --url https://api.devnet.solana.com
```

Verify your balance:

```bash
solana balance $(solana-keygen pubkey id.json) --url https://api.devnet.solana.com
```

Set up Anchor environment variables:

```bash
export ANCHOR_PROVIDER_URL='https://api.devnet.solana.com'
export ANCHOR_WALLET='./id.json'
```

### 4. Build and Deploy Programs

Build the programs:

```bash
anchor build
```

Sync the program keys:

```bash
anchor keys sync
```

Rebuild after syncing keys:

```bash
anchor build
```

Deploy to Devnet:

```bash
anchor deploy --provider.cluster devnet
```

**Important**: Note the Program IDs from the deployment output - you'll need these for the examples.

## Examples

Now that your environment is set up, let's explore what you can build!

### Example 1: Chainlink Data Feeds - Real-Time Price Data

**Goal**: Fetch real-time cryptocurrency price data (like SOL/USD) directly in your Solana program and display it.

**What you'll learn**: How to integrate Chainlink's decentralized price oracles into your Solana applications.

#### Steps:

1. **Read price data from any Chainlink Data Feed**:

   ```bash
   yarn read-data
   ```

   This will continuously display the latest SOL/USD price from Chainlink's price feed.

2. **Query a specific price feed** (e.g., ETH/USD):

   Edit `read-data.ts` and change the `CHAINLINK_FEED_ADDRESS` to:

   ```typescript
   const CHAINLINK_FEED_ADDRESS = "669U43LNHx7LsVj95uYksnhXUfWKDsdzVqev3V4Jpw3P"; // ETH/USD
   ```

   Then run:

   ```bash
   yarn read-data
   ```

3. **Use price data in an on-chain program**:

   Then run the interactive program:

   ```bash
   yarn client --feed 669U43LNHx7LsVj95uYksnhXUfWKDsdzVqev3V4Jpw3P
   ```

**Expected Outcome**: You should see real-time price data being fetched and displayed, with output similar to:

```
Price Is: 2428.920911
Success
```

### Example 2: CCIP Cross-Chain Token Transfers

**Goal**: Send tokens from Solana to Ethereum (or other EVM chains) using Chainlink's CCIP infrastructure.

**What you'll learn**: How to build truly cross-chain applications that can move assets between different blockchains.

#### Token Management

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

#### Steps:

1. **Get CCIP fee estimates**:

   ```bash
   yarn svm:fee
   ```

   This shows you how much it costs to send cross-chain messages.

2. **Send tokens from Solana to Ethereum**:

   ```bash
   yarn svm:token-transfer
   ```

   **Expected Outcome**: Your tokens will be locked on Solana and unlocked on the destination chain (Ethereum Sepolia). You'll receive transaction hashes for both chains.

### Example 3: CCIP Cross-Chain Messaging

**Goal**: Send arbitrary data (messages) from Solana to EVM chains.

**What you'll learn**: How to build cross-chain dApps that can coordinate state and trigger actions across multiple blockchains.

#### Steps:

1. **Send a cross-chain message**:

   ```bash
   yarn svm:arbitrary-messaging
   ```

2. **Send both data and tokens together**:
   ```bash
   yarn svm:data-and-tokens
   ```

**Expected Outcome**: Your message will be delivered to the destination chain, and you can verify it was received by checking the transaction on the destination blockchain explorer.

### Example 4: CCIP Receiver Program

**Goal**: Deploy and interact with a program that can receive cross-chain messages and tokens.

**What you'll learn**: How to build the receiving side of cross-chain applications.

#### Steps:

1. **Initialize the receiver program**:

   ```bash
   yarn svm:receiver:initialize
   ```

2. **Check for received messages**:

   ```bash
   yarn svm:receiver:get-message
   ```

3. **Deploy additional receiver instances**:
   ```bash
   yarn svm:receiver:deploy
   ```

**Expected Outcome**: You'll have a fully functional CCIP receiver that can accept and process cross-chain messages and tokens from any supported blockchain.

## Advanced Configuration

#### Token Management

Before performing CCIP operations, you may need to delegate token authority:

```bash
yarn svm:token:delegate
yarn svm:token:check
yarn svm:token:wrap  # For wrapping SOL to wSOL
```

#### EVM Operations

The starter kit also includes examples for initiating CCIP operations from EVM chains:

```bash
yarn evm:transfer
yarn evm:arbitrary-messaging
yarn evm:data-and-tokens
yarn evm:token:drip
```

## Testing

Run the integration tests to verify everything is working correctly:

```bash
anchor test
```

The integration test checks that the price feed data is accessible and returns valid values.

## What You've Accomplished

Congratulations! By completing this starter kit, you have:

✅ **Set up a complete Solana development environment** with Chainlink integration  
✅ **Built programs that access real-world data** using Chainlink Data Feeds  
✅ **Created cross-chain applications** that can transfer tokens and messages between Solana and EVM chains  
✅ **Deployed CCIP receiver programs** that can accept cross-chain interactions  
✅ **Learned the fundamentals** of building interoperable blockchain applications

You now have the foundation to build sophisticated cross-chain dApps that leverage Solana's speed and cost-effectiveness along with the liquidity and ecosystem of other major blockchains.

## Next Steps

- Explore the [Chainlink Documentation](https://docs.chain.link/) for more advanced features
- Check out additional [Solana Data Feeds](https://docs.chain.link/data-feeds/solana)
- Learn about [CCIP Solana Guides](https://docs.chain.link/ccip/tutorials/svm)
