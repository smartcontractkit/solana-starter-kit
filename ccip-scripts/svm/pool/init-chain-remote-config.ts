/**
 * Chain Remote Configuration Initialization Script
 *
 * This script initializes a chain remote configuration for a burn-mint token pool,
 * enabling cross-chain token transfers to a specific remote chain.
 *
 * INSTRUCTIONS:
 * 1. Ensure you have a Solana wallet with SOL for transaction fees (at least 0.01 SOL)
 * 2. The token pool must already exist for the specified mint
 * 3. Provide the required chain configuration details
 * 4. Run the script with: yarn svm:pool:init-chain-remote-config
 *
 * Required arguments:
 * --token-mint              : Token mint address of existing pool
 * --burn-mint-pool-program  : Burn-mint token pool program ID
 * --remote-chain            : Remote chain to configure (chain-id)
 * --token-address           : Token address on remote chain (hex)
 * --decimals                : Token decimals on remote chain
 *
 * Optional arguments:
 * --keypair                 : Path to your keypair file
 * --log-level               : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight          : Skip transaction preflight checks
 *
 * Example usage:
 * yarn svm:pool:init-chain-remote-config \
 *   --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
 *   --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \
 *   --remote-chain ethereum-sepolia \
 *   --token-address "0xA0b86991c431e59b4b59dac67ba9b82c31a30d15c" \
 *   --decimals 6
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createTokenPoolManager } from "../utils/client-factory";
import { TokenPoolType } from "../../../ccip-lib/svm";
import { BurnMintTokenPoolInfo } from "../../../ccip-lib/svm/tokenpools/burnmint/accounts";
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
  const logger = createLogger("init-chain-remote-config", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Chain Remote Configuration Initialization");

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

    const tokenAddress = options["token-address"] as string;
    const decimals = options.decimals as number;

    logger.info(`Token Mint: ${tokenMint.toString()}`);
    logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    logger.info(`Remote Chain Selector: ${remoteChainSelector.toString()}`);
    logger.info(`Token Address: ${tokenAddress}`);
    logger.info(`Decimals: ${decimals}`);

    logger.debug(`Configuration details:`);
    logger.debug(`  Network: ${config.id}`);
    logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    logger.debug(`  Commitment level: ${config.connection.commitment}`);
    logger.debug(`  Skip preflight: ${options["skip-preflight"]}`);
    logger.debug(`  Log level: ${options["log-level"]}`);

    // Create token pool manager using SDK
    const tokenPoolManager = createTokenPoolManager(
      burnMintPoolProgramId,
      {
        keypairPath: keypairPath,
        logLevel: (options["log-level"] as LogLevel) || LogLevel.INFO,
        skipPreflight: options["skip-preflight"],
      }
    );

    const tokenPoolClient = tokenPoolManager.getTokenPoolClient(TokenPoolType.BURN_MINT);

    // Initialize the chain remote config (pool addresses must be empty for initialization)
    logger.info("Initializing chain remote configuration...");
    const result = await tokenPoolClient.initChainRemoteConfig(tokenMint, remoteChainSelector, {
      tokenAddress,
      decimals,
      txOptions: {
        skipPreflight: options["skip-preflight"],
      },
    });
    const signature = result.signature;

    logger.info(`Chain remote configuration initialized successfully!`);
    logger.info(`Transaction signature: ${signature}`);
    logger.info(`Solana Explorer: ${getExplorerUrl(config.id, signature)}`);
    logger.info(
      `💡 View details: yarn svm:pool:get-info --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
    );
    logger.info(
      `🔗 Next step: Add pool addresses with 'yarn svm:pool:edit-chain-remote-config' to enable cross-chain transfers`
    );
  } catch (error) {
    logger.error("Chain remote configuration initialization failed:", error);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🔗 CCIP Chain Remote Configuration Initializer

Usage: yarn svm:pool:init-chain-remote-config [options]

Required Options:
  --token-mint <address>           Token mint address of existing pool
  --burn-mint-pool-program <id>    Burn-mint token pool program ID
  --remote-chain <chain-id>        Remote chain (chain-id)
  --token-address <address>        Token address on remote chain (hex)
  --decimals <number>              Token decimals on remote chain

Optional Options:
  --keypair <path>                 Path to wallet keypair file
  --log-level <level>              Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight                 Skip transaction preflight checks
  --help, -h                       Show this help message

Examples:
  yarn svm:pool:init-chain-remote-config \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --remote-chain ethereum-sepolia \\
    --token-address "0xA0b86991c431e59b4b59dac67ba9b82c31a30d15c" \\
    --decimals 6

  yarn svm:pool:init-chain-remote-config \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --remote-chain base-sepolia \\
    --token-address "0xA0b86991c431e59b4b59dac67ba9b82c31a30d15c" \\
    --decimals 6

Remote Chain Options:
`);

  displayAvailableRemoteChains();

  console.log(`
Notes:
  • The token pool must already exist before configuring chains
  • Wallet must be the pool administrator
  • Addresses should be provided as hex strings with '0x' prefix
  • Pool addresses are NOT provided during initialization (required by Rust program)
  • Use 'yarn svm:pool:edit-chain-remote-config' to add pool addresses after initialization
  • Chain configuration initialization requires SOL for transaction fees
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
