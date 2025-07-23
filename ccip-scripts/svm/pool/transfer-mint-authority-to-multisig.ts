/**
 * Transfer Mint Authority to Multisig Script
 *
 * This script transfers the mint authority of a token to a multisig account.
 * This is a critical security operation for production deployments that ensures
 * the mint authority is controlled by a multisig rather than a single key.
 *
 * SECURITY REQUIREMENTS:
 * - Only callable by the program upgrade authority
 * - The new multisig must be a valid Token Program or Token-2022 multisig account
 * - The multisig must include the pool signer as one of its signers
 * - The multisig must meet specific threshold requirements for security
 *
 * INSTRUCTIONS:
 * 1. Ensure you have a Solana wallet with SOL for transaction fees (at least 0.01 SOL)
 * 2. Ensure you are the program upgrade authority
 * 3. Provide the token mint, burn-mint pool program ID, and new multisig address
 * 4. Run the script with: yarn svm:pool:transfer-mint-authority-to-multisig
 *
 * Required arguments:
 * --token-mint                      : Token mint address whose authority should be transferred
 * --burn-mint-pool-program          : Burn-mint token pool program ID
 * --new-multisig-mint-authority     : PublicKey of the new multisig mint authority account
 *
 * Optional arguments:
 * --keypair                         : Path to your keypair file
 * --log-level                       : Logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
 * --skip-preflight                  : Skip transaction preflight checks
 *
 * Example usage:
 * yarn svm:pool:transfer-mint-authority-to-multisig \
 *   --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
 *   --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \
 *   --new-multisig-mint-authority FgS7xNY9uQvFunKEsWH2pSsDTH8SB78bfvgBLKAESzAZ
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType } from "../../../ccip-lib/svm";
import { BurnMintTokenPoolInfo } from "../../../ccip-lib/svm/tokenpools/burnmint/accounts";
import { ChainId, getCCIPSVMConfig, getExplorerUrl } from "../../config";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { parseArgs } from "../utils/args-parser";

// ========== CONFIGURATION ==========
// Customize these values if needed for your specific use case
const MIN_SOL_REQUIRED = 0.01; // Minimum SOL needed for transaction fees
// ========== END CONFIGURATION ==========

const SCRIPT_ARGS = [
  {
    name: "token-mint",
    description: "Token mint address whose authority should be transferred",
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
    name: "new-multisig-mint-authority",
    description: "PublicKey of the new multisig mint authority account",
    required: true,
    type: "string" as const,
  },
  {
    name: "keypair",
    description: "Path to your keypair file",
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
  const logger = createLogger("pool-transfer-mint-authority", {
    level: options.logLevel ?? LogLevel.INFO,
  });

  logger.info("CCIP Token Pool Transfer Mint Authority to Multisig");

  // Load configuration
  const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);

  // Get keypair path and load wallet
  const keypairPath =
    options.keypair || `${process.env.HOME}/.config/solana/id.json`;
  logger.info(`Loading keypair from ${keypairPath}...`);

  try {
    // Load wallet
    const fs = await import("fs");
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
    const { Keypair } = await import("@solana/web3.js");
    const walletKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));

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
    const newMultisigMintAuthority = new PublicKey(
      options["new-multisig-mint-authority"]
    );

    logger.info(`Token Mint: ${tokenMint.toString()}`);
    logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    logger.info(
      `New Multisig Mint Authority: ${newMultisigMintAuthority.toString()}`
    );

    logger.debug(`Configuration details:`);
    logger.debug(`  Network: ${config.id}`);
    logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    logger.debug(`  Commitment level: ${config.connection.commitment}`);
    logger.debug(`  Skip preflight: ${options["skip-preflight"]}`);
    logger.debug(`  Log level: ${options["log-level"]}`);

    // Create token pool manager using SDK
    const tokenPoolManager = TokenPoolManager.create(
      config.connection,
      walletKeypair,
      {
        burnMint: burnMintPoolProgramId,
         // Using same program for both
      },
      {
        ccipRouterProgramId: config.routerProgramId.toString(),
        feeQuoterProgramId: config.feeQuoterProgramId.toString(),
        rmnRemoteProgramId: config.rmnRemoteProgramId.toString(),
        linkTokenMint: config.linkTokenMint.toString(),
        receiverProgramId: config.receiverProgramId.toString(),
      },
      { logLevel: options["log-level"] || LogLevel.INFO }
    );

    const tokenPoolClient = tokenPoolManager.getTokenPoolClient(TokenPoolType.BURN_MINT);

    // Check if pool exists and get current pool info for verification
    logger.info("Checking if pool exists and fetching current pool configuration...");
    logger.debug(`Checking pool existence for mint: ${tokenMint.toString()}`);
    let poolInfo: BurnMintTokenPoolInfo;
    try {
      poolInfo = await tokenPoolClient.getPoolInfo(tokenMint) as BurnMintTokenPoolInfo;
      logger.debug(`Pool exists: true`);
      logger.info(`Pool owner: ${poolInfo.config.config.owner.toString()}`);

      logger.debug("Current pool details:", {
        poolType: poolInfo.poolType,
        owner: poolInfo.config.config.owner.toString(),
        version: poolInfo.config.version,
        decimals: poolInfo.config.config.decimals,
        router: poolInfo.config.config.router.toString(),
      });
    } catch (error) {
      logger.error("Pool does not exist for this token mint");
      logger.info("Initialize the pool first using 'yarn svm:pool:initialize'");
      logger.debug(
        `To initialize: yarn svm:pool:initialize --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
      );
      process.exit(1);
    }

    // Verify the new multisig address is valid
    logger.info("Verifying new multisig mint authority account...");
    const multisigAccountInfo = await config.connection.getAccountInfo(
      newMultisigMintAuthority
    );
    if (!multisigAccountInfo) {
      logger.error(
        `Multisig account not found: ${newMultisigMintAuthority.toString()}`
      );
      logger.info(
        "Ensure the multisig account exists and is properly configured"
      );
      process.exit(1);
    }
    logger.debug(
      `Multisig account owner: ${multisigAccountInfo.owner.toString()}`
    );

    // Transfer mint authority to multisig
    logger.info("Transferring mint authority to multisig...");
    logger.warn("⚠️  CRITICAL SECURITY OPERATION ⚠️");
    logger.warn("This will transfer mint authority to a multisig account.");
    logger.warn(
      "Ensure the multisig is properly configured and includes the pool signer."
    );

    const signature = await tokenPoolClient.transferMintAuthorityToMultisig(tokenMint, {
      newMultisigMintAuthority: newMultisigMintAuthority,
      skipPreflight: options["skip-preflight"],
    });

    logger.info(`Mint authority transferred successfully! 🎉`);
    logger.info(`Transaction signature: ${signature}`);
    logger.info(`Solana Explorer: ${getExplorerUrl(config.id, signature)}`);

    // Display summary
    logger.info("");
    logger.info("🔐 Mint Authority Transfer Summary:");
    logger.info("===================================");
    logger.info(`   Token Mint: ${tokenMint.toString()}`);
    logger.info(
      `   New Multisig Authority: ${newMultisigMintAuthority.toString()}`
    );
    logger.info(`   Pool Program: ${burnMintPoolProgramId.toString()}`);
    logger.info(`   Transaction: ${signature}`);
    logger.info("");

    logger.info("🔗 Next Steps:");
    logger.info(
      "  Verify the mint authority transfer using token program commands"
    );
    logger.info("");

    logger.info("💡 Verification Commands:");
    logger.info(`  spl-token display ${tokenMint.toString()}`);
  } catch (error) {
    logger.error("Mint authority transfer failed:", error);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
🔐 CCIP Token Pool Mint Authority Transfer to Multisig

Usage: yarn svm:pool:transfer-mint-authority-to-multisig [options]

Required Options:
  --token-mint <address>                    Token mint address whose authority should be transferred
  --burn-mint-pool-program <id>             Burn-mint token pool program ID  
  --new-multisig-mint-authority <address>   PublicKey of the new multisig mint authority account

Optional Options:
  --keypair <path>                          Path to wallet keypair file
  --log-level <level>                       Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
  --skip-preflight                          Skip transaction preflight checks
  --help, -h                                Show this help message

Examples:
  yarn svm:pool:transfer-mint-authority-to-multisig \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --new-multisig-mint-authority FgS7xNY9uQvFunKEsWH2pSsDTH8SB78bfvgBLKAESzAZ

  yarn svm:pool:transfer-mint-authority-to-multisig \\
    --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\
    --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \\
    --new-multisig-mint-authority FgS7xNY9uQvFunKEsWH2pSsDTH8SB78bfvgBLKAESzAZ \\
    --log-level DEBUG

Security Notes:
  • This is a CRITICAL SECURITY OPERATION
  • Only callable by the program upgrade authority
  • The new multisig must be a valid Token Program or Token-2022 multisig account
  • The multisig must include the pool signer as one of its signers
  • The multisig must meet specific threshold requirements for security
  • Verify multisig configuration before executing this operation

Purpose:
  This script transfers the mint authority of a token to a multisig account for enhanced
  security in production deployments. This ensures that mint operations require multiple
  signatures rather than relying on a single key.

Important:
  • Always test multisig configuration in development first
  • Document multisig signer information and procedures
  • Keep secure backups of all multisig signer keys
  • Verify the transfer was successful after execution
  `);
}

// Run the script
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
