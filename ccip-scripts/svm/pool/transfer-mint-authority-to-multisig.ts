/**
 * Transfer Mint Authority to Multisig Script (CLI Framework Version)
 *
 * This script transfers the mint authority of a token to a multisig account.
 * This is a critical security operation for production deployments that ensures
 * the mint authority is controlled by a multisig rather than a single key.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType, LogLevel, createLogger } from "../../../ccip-lib/svm";
import { BurnMintTokenPoolInfo } from "../../../ccip-lib/svm/tokenpools/burnmint/accounts";
import { resolveNetworkConfig, getExplorerUrl } from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for transfer mint authority operations
 */
const TRANSFER_AUTHORITY_CONFIG = {
  minSolRequired: 0.01,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the transfer-mint-authority-to-multisig command
 */
interface TransferMintAuthorityOptions extends BaseCommandOptions {
  tokenMint: string;
  burnMintPoolProgram: string;
  newMultisigMintAuthority: string;
}

/**
 * Transfer Mint Authority to Multisig Command
 */
class TransferMintAuthorityCommand extends CCIPCommand<TransferMintAuthorityOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "transfer-mint-authority-to-multisig",
      description: "🔐 Transfer Mint Authority to Multisig\n\nTransfers the mint authority of a token to a multisig account. This is a critical security operation for production deployments that ensures the mint authority is controlled by a multisig rather than a single key.",
      examples: [
        "# Transfer mint authority to multisig",
        "yarn svm:pool:transfer-mint-authority-to-multisig --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --new-multisig-mint-authority FgS7xNY9uQvFunKEsWH2pSsDTH8SB78bfvgBLKAESzAZ",
        "",
        "# Transfer with debug logging",
        "yarn svm:pool:transfer-mint-authority-to-multisig --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --new-multisig-mint-authority FgS7xNY9uQvFunKEsWH2pSsDTH8SB78bfvgBLKAESzAZ --log-level DEBUG"
      ],
      notes: [
        "⚠️ CRITICAL SECURITY OPERATION - This transfers mint authority permanently",
        "Only callable by the program upgrade authority",
        `Minimum ${TRANSFER_AUTHORITY_CONFIG.minSolRequired} SOL required for transaction fees`,
        "The new multisig must be a valid Token Program or Token-2022 multisig account",
        "The multisig must include the pool signer as one of its signers",
        "The multisig must meet specific threshold requirements for security",
        "Verify multisig configuration before executing this operation",
        "Always test multisig configuration in development first",
        "Use 'spl-token display <mint>' to verify the transfer was successful"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "token-mint",
        required: true,
        type: "string",
        description: "Token mint address whose authority should be transferred",
        example: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
      },
      {
        name: "burn-mint-pool-program",
        required: true,
        type: "string",
        description: "Burn-mint token pool program ID",
        example: "2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh"
      },
      {
        name: "new-multisig-mint-authority",
        required: true,
        type: "string",
        description: "PublicKey of the new multisig mint authority account",
        example: "FgS7xNY9uQvFunKEsWH2pSsDTH8SB78bfvgBLKAESzAZ"
      }
    ];
  }

  protected async execute(): Promise<void> {
    this.logger.info("🔐 CCIP Token Pool Transfer Mint Authority to Multisig");
    this.logger.info("==========================================");
    this.logger.warn("⚠️  CRITICAL SECURITY OPERATION - This transfers mint authority permanently");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet (must be upgrade authority)
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Wallet: ${walletKeypair.publicKey.toString()}`);

    // Check SOL balance
    this.logger.info("");
    this.logger.info("💰 WALLET BALANCE");
    this.logger.info("==========================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalance.toFixed(9)} SOL)`);

    if (solBalance < TRANSFER_AUTHORITY_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient balance. Need at least ${TRANSFER_AUTHORITY_CONFIG.minSolRequired} SOL for transaction fees.\n` +
        `Current balance: ${solBalance.toFixed(9)} SOL\n\n` +
        `Request airdrop with:\n` +
        `solana airdrop 1 ${walletKeypair.publicKey.toString()} --url devnet`
      );
    }

    // Parse and validate addresses
    let tokenMint: PublicKey;
    let burnMintPoolProgramId: PublicKey;
    let newMultisigMintAuthority: PublicKey;
    
    try {
      tokenMint = new PublicKey(this.options.tokenMint);
    } catch {
      throw new Error(`Invalid token mint address: ${this.options.tokenMint}`);
    }
    
    try {
      burnMintPoolProgramId = new PublicKey(this.options.burnMintPoolProgram);
    } catch {
      throw new Error(`Invalid burn-mint pool program ID: ${this.options.burnMintPoolProgram}`);
    }
    
    try {
      newMultisigMintAuthority = new PublicKey(this.options.newMultisigMintAuthority);
    } catch {
      throw new Error(`Invalid new multisig mint authority address: ${this.options.newMultisigMintAuthority}`);
    }

    // Display configuration
    this.logger.info("");
    this.logger.info("📋 TRANSFER CONFIGURATION");
    this.logger.info("==========================================");
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    this.logger.info(`New Multisig Mint Authority: ${newMultisigMintAuthority.toString()}`);

    this.logger.debug("Configuration details:");
    this.logger.debug(`  Network: ${config.id}`);
    this.logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    this.logger.debug(`  Commitment level: ${config.connection.commitment}`);
    this.logger.debug(`  Skip preflight: ${this.options.skipPreflight}`);

    try {
      // Create token pool manager using SDK
      const tokenPoolManager = TokenPoolManager.create(
        config.connection,
        walletKeypair,
        {
          burnMint: burnMintPoolProgramId,
        },
        {
          ccipRouterProgramId: config.routerProgramId.toString(),
          feeQuoterProgramId: config.feeQuoterProgramId.toString(),
          rmnRemoteProgramId: config.rmnRemoteProgramId.toString(),
          linkTokenMint: config.linkTokenMint.toString(),
          receiverProgramId: config.receiverProgramId.toString(),
        },
        { logLevel: this.options.logLevel ?? LogLevel.INFO }
      );

      const tokenPoolClient = tokenPoolManager.getTokenPoolClient(TokenPoolType.BURN_MINT);

      // Check if pool exists and get current pool info for verification
      this.logger.info("");
      this.logger.info("🔍 VERIFYING POOL EXISTENCE");
      this.logger.info("==========================================");
      this.logger.info("Checking if pool exists and fetching current pool configuration...");
      
      let poolInfo: BurnMintTokenPoolInfo;
      try {
        poolInfo = await tokenPoolClient.getPoolInfo(tokenMint) as BurnMintTokenPoolInfo;
        this.logger.info("✅ Pool exists");
        this.logger.info(`Pool owner: ${poolInfo.config.config.owner.toString()}`);

        this.logger.debug("Current pool details:", {
          poolType: poolInfo.poolType,
          owner: poolInfo.config.config.owner.toString(),
          version: poolInfo.config.version,
          decimals: poolInfo.config.config.decimals,
          router: poolInfo.config.config.router.toString(),
        });
      } catch (error) {
        this.logger.error("");
        this.logger.error("❌ POOL NOT FOUND");
        this.logger.error("==========================================");
        this.logger.error("Pool does not exist for this token mint");
        this.logger.error("Initialize the pool first using 'yarn svm:pool:initialize'");
        this.logger.debug(
          `To initialize: yarn svm:pool:initialize --token-mint ${tokenMint.toString()} --burn-mint-pool-program ${burnMintPoolProgramId.toString()}`
        );
        throw new Error("Pool does not exist for this token mint");
      }

      // Verify the new multisig address is valid
      this.logger.info("");
      this.logger.info("🔍 VERIFYING MULTISIG ACCOUNT");
      this.logger.info("==========================================");
      this.logger.info("Verifying new multisig mint authority account...");
      
      const multisigAccountInfo = await config.connection.getAccountInfo(newMultisigMintAuthority);
      if (!multisigAccountInfo) {
        throw new Error(
          `Multisig account not found: ${newMultisigMintAuthority.toString()}\n` +
          "Ensure the multisig account exists and is properly configured"
        );
      }
      
      this.logger.info("✅ Multisig account exists");
      this.logger.debug(`Multisig account owner: ${multisigAccountInfo.owner.toString()}`);

      // Transfer mint authority to multisig
      this.logger.info("");
      this.logger.info("🔧 TRANSFERRING MINT AUTHORITY");
      this.logger.info("==========================================");
      this.logger.warn("⚠️  CRITICAL SECURITY OPERATION ⚠️");
      this.logger.warn("This will transfer mint authority to a multisig account.");
      this.logger.warn("Ensure the multisig is properly configured and includes the pool signer.");
      this.logger.info("Executing transfer...");

      const signature = await tokenPoolClient.transferMintAuthorityToMultisig(tokenMint, {
        newMultisigMintAuthority: newMultisigMintAuthority,
        skipPreflight: this.options.skipPreflight,
      });

      // Display results
      this.logger.info("");
      this.logger.info("✅ MINT AUTHORITY TRANSFERRED SUCCESSFULLY");
      this.logger.info("==========================================");
      this.logger.info(`Transaction Signature: ${signature}`);

      // Display explorer URL
      this.logger.info("");
      this.logger.info("🔍 EXPLORER URLS");
      this.logger.info("==========================================");
      this.logger.info(`Transaction: ${getExplorerUrl(config.id, signature)}`);

      // Display summary
      this.logger.info("");
      this.logger.info("🔐 MINT AUTHORITY TRANSFER SUMMARY");
      this.logger.info("==========================================");
      this.logger.info(`Token Mint: ${tokenMint.toString()}`);
      this.logger.info(`New Multisig Authority: ${newMultisigMintAuthority.toString()}`);
      this.logger.info(`Pool Program: ${burnMintPoolProgramId.toString()}`);
      this.logger.info(`Transaction: ${signature}`);

      this.logger.info("");
      this.logger.info("📋 NEXT STEPS");
      this.logger.info("==========================================");
      this.logger.info("1. Verify the mint authority transfer:");
      this.logger.info(`   spl-token display ${tokenMint.toString()}`);
      this.logger.info("");
      this.logger.info("2. Test multisig operations to ensure proper configuration");
      this.logger.info("3. Document multisig signer information and procedures");
      this.logger.info("4. Keep secure backups of all multisig signer keys");

      this.logger.info("");
      this.logger.info("🎉 Mint Authority Transfer Complete!");
      this.logger.info("✅ Mint authority successfully transferred to multisig");
      this.logger.info("✅ Enhanced security now in place for mint operations");
      
    } catch (error) {
      this.logger.error(
        `❌ Failed to transfer mint authority: ${error instanceof Error ? error.message : String(error)}`
      );

      if (error instanceof Error && error.stack) {
        this.logger.debug("\nError stack:");
        this.logger.debug(error.stack);
      }

      throw error;
    }
  }
}

// Create and run the command
const command = new TransferMintAuthorityCommand();
command.run().catch((error) => {
  process.exit(1);
});