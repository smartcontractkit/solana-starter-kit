/**
 * Update Self-Served Allowed Global Config Script (CLI Framework Version)
 *
 * This script updates the global self-served allowed flag for a burn-mint token pool program.
 * This flag controls whether pool creators can initialize pools without being the program upgrade authority.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenPoolManager } from "../../../ccip-lib/svm/core/client/tokenpools";
import { TokenPoolType, LogLevel, createLogger } from "../../../ccip-lib/svm";
import { resolveNetworkConfig, getExplorerUrl } from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for update self-served allowed operations
 */
const UPDATE_SELF_SERVED_CONFIG = {
  minSolRequired: 0.01,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the update-self-served-allowed command
 */
interface UpdateSelfServedAllowedOptions extends BaseCommandOptions {
  burnMintPoolProgram: string;
  selfServedAllowed: boolean;
}

/**
 * Update Self-Served Allowed Command
 */
class UpdateSelfServedAllowedCommand extends CCIPCommand<UpdateSelfServedAllowedOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "update-self-served-allowed",
      description: "🔧 Update Self-Served Pool Creation\n\nUpdates the global self-served allowed flag for a burn-mint token pool program. This flag controls whether pool creators can initialize pools without being the program upgrade authority.",
      examples: [
        "# Allow mint authority holders to create pools",
        "yarn svm:pool:update-self-served-allowed --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --self-served-allowed true",
        "",
        "# Restrict pool creation to upgrade authority only",
        "yarn svm:pool:update-self-served-allowed --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --self-served-allowed false",
        "",
        "# With debug logging",
        "yarn svm:pool:update-self-served-allowed --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --self-served-allowed true --log-level DEBUG"
      ],
      notes: [
        "⚠️ This must be run by the program upgrade authority",
        `Minimum ${UPDATE_SELF_SERVED_CONFIG.minSolRequired} SOL required for transaction fees`,
        "Setting to 'true' allows anyone with mint authority to create pools",
        "Setting to 'false' restricts pool creation to upgrade authority only",
        "This affects ALL future pool creations across the program",
        "Existing pools are not affected by this change",
        "Consider security implications before enabling self-served mode",
        "Verifies the update after transaction completes"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "burn-mint-pool-program",
        required: true,
        type: "string",
        description: "Burn-mint token pool program ID",
        example: "2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh"
      },
      {
        name: "self-served-allowed",
        required: true,
        type: "boolean",
        description: "Allow self-served pool creation (true/false)",
        example: "true"
      }
    ];
  }

  protected async execute(): Promise<void> {
    this.logger.info("🔧 CCIP Token Pool Update Self-Served Allowed Flag");
    this.logger.info("==========================================");
    this.logger.warn("⚠️  This must be run by the program upgrade authority");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet (must be upgrade authority)
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Wallet: ${walletKeypair.publicKey.toString()}`);
    this.logger.warn("🔑 Ensure this wallet is the program upgrade authority for the token pool program");

    // Check SOL balance
    this.logger.info("");
    this.logger.info("💰 WALLET BALANCE");
    this.logger.info("==========================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalance.toFixed(9)} SOL)`);

    if (solBalance < UPDATE_SELF_SERVED_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient balance. Need at least ${UPDATE_SELF_SERVED_CONFIG.minSolRequired} SOL for transaction fees.\n` +
        `Current balance: ${solBalance.toFixed(9)} SOL\n\n` +
        `Request airdrop with:\n` +
        `solana airdrop 1 ${walletKeypair.publicKey.toString()} --url devnet`
      );
    }

    // Parse and validate burn-mint pool program ID
    let burnMintPoolProgramId: PublicKey;
    try {
      burnMintPoolProgramId = new PublicKey(this.options.burnMintPoolProgram);
    } catch {
      throw new Error(`Invalid burn-mint pool program ID: ${this.options.burnMintPoolProgram}`);
    }

    const selfServedAllowed = this.options.selfServedAllowed;

    // Display configuration
    this.logger.info("");
    this.logger.info("📋 UPDATE CONFIGURATION");
    this.logger.info("==========================================");
    this.logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);
    this.logger.info(`New Self-Served Allowed: ${selfServedAllowed}`);

    if (selfServedAllowed) {
      this.logger.info("🔓 Pool creation will be allowed for mint authority holders");
    } else {
      this.logger.info("🔒 Pool creation will be restricted to program upgrade authority only");
    }

    this.logger.debug("Update self-served allowed details:");
    this.logger.debug(`  Network: ${config.id}`);
    this.logger.debug(`  Connection endpoint: ${config.connection.rpcEndpoint}`);
    this.logger.debug(`  Commitment level: ${config.connection.commitment}`);
    this.logger.debug(`  Authority: ${walletKeypair.publicKey.toString()}`);
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

      // Get current global config to show current value
      this.logger.info("");
      this.logger.info("🔍 CURRENT CONFIGURATION");
      this.logger.info("==========================================");
      try {
        const globalConfig = await tokenPoolClient.getGlobalConfigInfo();
        const currentValue = globalConfig.config.self_served_allowed;
        this.logger.info(`Current self-served allowed: ${currentValue}`);

        if (currentValue === selfServedAllowed) {
          this.logger.info("");
          this.logger.info("✅ ALREADY UP TO DATE");
          this.logger.info("==========================================");
          this.logger.info("Self-served allowed flag is already set to the desired value");
          this.logger.info("No changes needed");
          return;
        }

        this.logger.debug("Current global config details:", {
          version: globalConfig.config.version,
          selfServedAllowed: currentValue,
          router: globalConfig.config.router.toString(),
          rmnRemote: globalConfig.config.rmn_remote.toString(),
        });
      } catch (error) {
        this.logger.warn(`Could not fetch current global config: ${error}`);
        this.logger.debug("Global config fetch error:", error);
        this.logger.info("Proceeding with update...");
      }

      // Update the self-served allowed flag
      this.logger.info("");
      this.logger.info("🔧 UPDATING SELF-SERVED ALLOWED FLAG");
      this.logger.info("==========================================");
      this.logger.info("Updating the program-wide configuration...");
      
      this.logger.debug("Calling SDK updateSelfServedAllowed method...");
      this.logger.debug(`Transaction options: skipPreflight=${this.options.skipPreflight}`);

      const signature = await tokenPoolClient.updateSelfServedAllowed({
        selfServedAllowed: selfServedAllowed,
        skipPreflight: this.options.skipPreflight,
      });

      this.logger.debug(`Transaction completed with signature: ${signature}`);

      // Display results
      this.logger.info("");
      this.logger.info("✅ SELF-SERVED FLAG UPDATED SUCCESSFULLY");
      this.logger.info("==========================================");
      this.logger.info(`Transaction Signature: ${signature}`);

      // Display explorer URL
      this.logger.info("");
      this.logger.info("🔍 EXPLORER URLS");
      this.logger.info("==========================================");
      this.logger.info(`Transaction: ${getExplorerUrl(config.id, signature)}`);

      // Verify the update
      this.logger.info("");
      this.logger.info("🔍 VERIFYING UPDATE");
      this.logger.info("==========================================");
      
      try {
        const updatedGlobalConfig = await tokenPoolClient.getGlobalConfigInfo();
        const updatedValue = updatedGlobalConfig.config.self_served_allowed;

        if (updatedValue === selfServedAllowed) {
          this.logger.info("✅ Update verified successfully!");
          this.logger.info(`Updated value: ${updatedValue}`);
          
          this.logger.debug("Update verification details:", {
            newValue: updatedValue,
            version: updatedGlobalConfig.config.version,
          });
        } else {
          this.logger.warn("Update completed but verification shows different value");
          this.logger.warn(`Expected: ${selfServedAllowed}`);
          this.logger.warn(`Actual: ${updatedValue}`);
        }
      } catch (error) {
        this.logger.warn(`Update transaction succeeded but verification failed: ${error}`);
        this.logger.debug("Verification error details:", error);
        this.logger.info("This may be due to network delays - the flag should be updated shortly");
      }

      // Display impact summary
      this.logger.info("");
      this.logger.info("📋 UPDATE IMPACT");
      this.logger.info("==========================================");
      
      if (selfServedAllowed) {
        this.logger.info("Effect: Token holders with mint authority can now create pools");
        this.logger.info("Security: Ensure only trusted token mints use this feature");
      } else {
        this.logger.info("Effect: Only program upgrade authority can create new pools");
        this.logger.info("Security: Maximum control over pool creation");
      }

      this.logger.info("");
      this.logger.info("🎉 Self-Served Flag Update Complete!");
      this.logger.info("✅ Global configuration has been updated");
      
    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes("Unauthorized")) {
          this.logger.error("");
          this.logger.error("🚨 AUTHORIZATION ERROR");
          this.logger.error("==========================================");
          this.logger.error("The wallet is not the program upgrade authority for this program.");
          this.logger.error("Only the program upgrade authority can update global config settings.");
          throw error;
        }
      }

      this.logger.error(
        `❌ Failed to update self-served allowed flag: ${error instanceof Error ? error.message : String(error)}`
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
const command = new UpdateSelfServedAllowedCommand();
command.run().catch((error) => {
  process.exit(1);
});