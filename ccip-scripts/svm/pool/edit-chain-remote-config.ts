/**
 * Chain Remote Configuration Edit Script
 *
 * This script edits an existing chain remote configuration for a burn-mint token pool,
 * updating the configuration for cross-chain token transfers to a specific remote chain.
 *
 * INSTRUCTIONS:
 * 1. Ensure you have a Solana wallet with SOL for transaction fees (at least 0.01 SOL)
 * 2. The token pool and chain configuration must already exist
 * 3. Provide the updated chain configuration details
 * 4. Run the script with: yarn svm:pool:edit-chain-remote-config
 *
 * Required arguments:
 * --token-mint              : Token mint address of existing pool
 * --burn-mint-pool-program  : Burn-mint token pool program ID
 * --remote-chain            : Remote chain to configure (chain-id)
 * --pool-addresses          : Comma-separated pool addresses on remote chain (hex)
 * --token-address           : Token address on remote chain (hex)
 * --decimals                : Token decimals on remote chain
 *
 * Optional arguments:
 * --keypair                 : Path to your keypair file
 * --log-level               : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight          : Skip transaction preflight checks
 *
 * Example usage:
 * yarn svm:pool:edit-chain-remote-config \
 *   --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
 *   --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \
 *   --remote-chain ethereum-sepolia \
 *   --pool-addresses "0x742d35Cc6634C0532925a3b8D5c42A2cDd1e4b6d" \
 *   --token-address "0xA0b86991c431e59b4b59dac67ba9b82c31a30d15c" \
 *   --decimals 6
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createTokenPoolClient, TokenPoolClientOptions } from "./client";
import { ChainId, getCCIPSVMConfig, getExplorerUrl } from "../../config";
import { loadKeypair, getKeypairPath } from "../utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { parseArgs, displayAvailableRemoteChains } from "../utils/args-parser";

// ========== CONFIGURATION ==========
// Customize these values if needed for your specific use case
const MIN_SOL_REQUIRED = 0.01; // Minimum SOL needed for transaction fees
// ========== END CONFIGURATION ==========

const SCRIPT_ARGS = [
  {
    name: "token-mint",
    description: "Token mint address of existing pool",
    required: true,
    type: "string" as const,
  },
  {
    name: "burn-mint-pool-program",
    description: "Burn-mint token pool program ID",
    required: true,
    type: "string" as const,
  },
  {
    name: "remote-chain",
    description: "Remote chain to configure (chain-id)",
    required: true,
    type: "remote-chain" as const,
  },
  {
    name: "pool-addresses",
    description: "Comma-separated pool addresses on remote chain (hex)",
    required: true,
    type: "string" as const,
  },
  {
    name: "token-address",
    description: "Token address on remote chain (hex)",
    required: true,
    type: "string" as const,
  },
  {
    name: "decimals",
    description: "Token decimals on remote chain",
    required: true,
    type: "number" as const,
  },
  {
    name: "keypair",
    description: "Path to wallet keypair file",
    required: false,
    type: "string" as const,
  },
  {
    name: "log-level",
    description: "Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)",
    required: false,
    type: "string" as const,
  },
  {
    name: "skip-preflight",
    description: "Skip transaction preflight checks",
    required: false,
    type: "boolean" as const,
    default: false,
  },
];

async function main() {
  // Check for help
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  // Parse arguments
  const options = parseArgs(SCRIPT_ARGS);

  // Create logger
  const logger = createLogger("edit-chain-remote-config", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Chain Remote Configuration Editor");

  // Load configuration
  const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);

  // Get keypair path and load wallet
  const keypairPath = getKeypairPath(options);
  logger.info(`Loading keypair from ${keypairPath}...`);

  try {
    const walletKeypair = loadKeypair(keypairPath);
    logger.info(`Wallet public key: ${walletKeypair.publicKey.toString()}`);

    // Check balance
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    logger.info(`Wallet balance: ${solBalance} SOL`);

    if (solBalance < MIN_SOL_REQUIRED) {
      logger.error(
        `Insufficient balance. Need at least ${MIN_SOL_REQUIRED} SOL for transaction fees.`
      );
      logger.info(
        "Request airdrop from Solana devnet faucet before proceeding."
      );
      logger.info(
        `solana airdrop 1 ${walletKeypair.publicKey.toString()} --url devnet`
      );
      process.exit(1);
    }

    // Parse addresses
    const tokenMint = new PublicKey(options["token-mint"]);
    const burnMintPoolProgramId = new PublicKey(
      options["burn-mint-pool-program"]
    );
    const remoteChainSelector = options["remote-chain"] as bigint;

    // Parse pool addresses
    const poolAddressesInput = options["pool-addresses"] as string;
    const poolAddresses = poolAddressesInput
      .split(",")
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0);

    const tokenAddress = options["token-address"] as string;
    const decimals = options.decimals as number;

    logger.info(`Token Mint: ${tokenMint.toString()}`);
    logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    logger.info(`Remote Chain Selector: ${remoteChainSelector.toString()}`);
    logger.info(`Pool Addresses: ${poolAddresses.join(", ")}`);
    logger.info(`Token Address: ${tokenAddress}`);
    logger.info(`Decimals: ${decimals}`);

    logger.debug(`Configuration details:`);
    logger.debug(`  Network: ${config.id}`);
    logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    logger.debug(`  Commitment level: ${config.connection.commitment}`);
    logger.debug(`  Skip preflight: ${options["skip-preflight"]}`);
    logger.debug(`  Log level: ${options["log-level"]}`);

    // Create token pool client
    const clientOptions: TokenPoolClientOptions = {
      connection: config.connection,
      logLevel: (options["log-level"] as LogLevel) || LogLevel.INFO,
      skipPreflight: options["skip-preflight"],
    };

    const tokenPoolClient = await createTokenPoolClient(
      burnMintPoolProgramId,
      tokenMint,
      clientOptions
    );

    // Edit the chain remote config
    logger.info("Editing chain remote configuration...");
    const signature = await tokenPoolClient.editChainRemoteConfig({
      mint: tokenMint,
      remoteChainSelector,
      poolAddresses,
      tokenAddress,
      decimals,
    });

    logger.info(`Chain remote configuration edited successfully!`);
    logger.info(`Transaction signature: ${signature}`);
    logger.info(`Solana Explorer: ${getExplorerUrl(config.id, signature)}`);
    logger.info(
      `💡 View details: yarn svm:pool:get-info --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
    );
  } catch (error) {
    logger.error("Chain remote configuration edit failed:", error);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🔗 CCIP Chain Remote Configuration Editor

Usage: yarn svm:pool:edit-chain-remote-config [options]

Required Options:
  --token-mint <address>           Token mint address of existing pool
  --burn-mint-pool-program <id>    Burn-mint token pool program ID
  --remote-chain <chain-id>        Remote chain (chain-id)
  --pool-addresses <addresses>     Comma-separated pool addresses (hex)
  --token-address <address>        Token address on remote chain (hex)
  --decimals <number>              Token decimals on remote chain

Optional Options:
  --keypair <path>                 Path to wallet keypair file
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight                 Skip transaction preflight checks
  --help, -h                       Show this help message

Examples:
  yarn svm:pool:edit-chain-remote-config \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --remote-chain ethereum-sepolia \\
    --pool-addresses "0x742d35Cc6634C0532925a3b8D5c42A2cDd1e4b6d" \\
    --token-address "0xA0b86991c431e59b4b59dac67ba9b82c31a30d15c" \\
    --decimals 6

  yarn svm:pool:edit-chain-remote-config \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --remote-chain ethereum-sepolia \\
    --pool-addresses "0x742d35Cc6634C0532925a3b8D5c42A2cDd1e4b6d,0x123..." \\
    --token-address "0xA0b86991c431e59b4b59dac67ba9b82c31a30d15c" \\
    --decimals 6

Remote Chain Options:
`);

  displayAvailableRemoteChains();

  console.log(`
Notes:
  • The token pool and chain configuration must already exist
  • Wallet must be the pool administrator
  • Addresses should be provided as hex strings with '0x' prefix
  • Multiple pool addresses can be separated by commas
  • Chain configuration editing requires SOL for transaction fees
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
