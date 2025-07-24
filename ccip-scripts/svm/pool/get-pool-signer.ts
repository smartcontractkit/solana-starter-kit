/**
 * Token Pool Signer PDA Retrieval Script (CLI Framework Version)
 *
 * This script retrieves the Pool Signer PDA for a burn-mint token pool.
 * The Pool Signer PDA is used as the authority for token operations and
 * is essential for transferring mint authority to enable CCIP functionality.
 */

import { PublicKey } from "@solana/web3.js";
import { findPoolSignerPDA } from "../../../ccip-lib/svm/utils/pdas/tokenpool";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for get pool signer operations
 */
const GET_POOL_SIGNER_CONFIG = {
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the get-pool-signer command
 */
interface GetPoolSignerOptions extends BaseCommandOptions {
  tokenMint: string;
  burnMintPoolProgram: string;
}

/**
 * Get Pool Signer Command
 */
class GetPoolSignerCommand extends CCIPCommand<GetPoolSignerOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "get-pool-signer",
      description: "🔍 Token Pool Signer PDA Reader\n\nRetrieves the Pool Signer PDA for a burn-mint token pool. The Pool Signer PDA is used as the authority for token operations and is essential for transferring mint authority to enable CCIP functionality.",
      examples: [
        "# Get pool signer PDA",
        "yarn svm:pool:get-pool-signer --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh",
        "",
        "# Get pool signer with debug logging",
        "yarn svm:pool:get-pool-signer --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh --log-level DEBUG"
      ],
      notes: [
        "This is a read-only operation that doesn't require a wallet",
        "The PDA is deterministically derived from the token mint and program ID",
        "Use the returned address to transfer mint authority to the token pool",
        "The pool program uses this PDA for automated token operations during CCIP transfers",
        "This PDA serves as the authority for token operations",
        "Transfer mint authority to this address to enable CCIP",
        "The pool program will use this PDA for burns/mints during cross-chain transfers",
        "Seeds used: ['ccip_tokenpool_signer', token_mint]"
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
        description: "Token mint address",
        example: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
      },
      {
        name: "burn-mint-pool-program",
        required: true,
        type: "string",
        description: "Burn-mint token pool program ID",
        example: "2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh"
      }
    ];
  }

  protected async execute(): Promise<void> {
    this.logger.info("🔍 CCIP Token Pool Signer PDA Reader (Read-Only)");
    this.logger.info("==========================================");

    // Parse and validate addresses
    let tokenMint: PublicKey;
    let burnMintPoolProgramId: PublicKey;
    
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

    // Display input parameters
    this.logger.info(`Token Mint: ${tokenMint.toString()}`);
    this.logger.info(`Burn-Mint Pool Program: ${burnMintPoolProgramId.toString()}`);

    this.logger.debug("Configuration details:");
    this.logger.debug(`  Log level: ${this.options.logLevel}`);

    try {
      // Derive the Pool Signer PDA
      this.logger.info("");
      this.logger.info("🔧 DERIVING POOL SIGNER PDA");
      this.logger.info("==========================================");
      this.logger.info("Deriving Pool Signer PDA...");
      
      const [poolSignerPDA, poolSignerBump] = findPoolSignerPDA(
        tokenMint,
        burnMintPoolProgramId
      );

      // Display the results
      this.logger.info("");
      this.logger.info("📋 POOL SIGNER PDA DETAILS");
      this.logger.info("==========================================");
      this.logger.info(`Address: ${poolSignerPDA.toString()}`);
      this.logger.info(`Bump Seed: ${poolSignerBump}`);

      this.logger.info("");
      this.logger.info("🔧 PDA DERIVATION");
      this.logger.info("------------------------------------------");
      this.logger.info(`Seeds: ["ccip_tokenpool_signer", "${tokenMint.toString()}"]`);
      this.logger.info(`Program: ${burnMintPoolProgramId.toString()}`);

      this.logger.info("");
      this.logger.info("📝 USAGE NOTES");
      this.logger.info("------------------------------------------");
      this.logger.info("• This PDA serves as the authority for token operations");
      this.logger.info("• Transfer mint authority to this address to enable CCIP");
      this.logger.info("• The pool program will use this PDA for burns/mints during cross-chain transfers");

      this.logger.info("");
      this.logger.info("🔗 NEXT STEPS");
      this.logger.info("------------------------------------------");
      this.logger.info("1. Transfer mint authority to this PDA address");
      this.logger.info("2. Verify the transfer using token program commands");
      this.logger.info("3. The token pool will then have authority for CCIP operations");

      this.logger.info("");
      this.logger.info("💡 Use this PDA address for mint authority transfer operations");

      this.logger.info("");
      this.logger.info("🎉 Pool Signer PDA Retrieved Successfully!");
      this.logger.info(`✅ PDA Address: ${poolSignerPDA.toString()}`);
      
    } catch (error) {
      this.logger.error(
        `❌ Failed to derive Pool Signer PDA: ${error instanceof Error ? error.message : String(error)}`
      );

      this.logger.info("");
      this.logger.info("❌ COMMON ISSUES");
      this.logger.info("==========================================");
      this.logger.info("• Invalid token mint address format");
      this.logger.info("• Invalid burn-mint pool program ID format");

      this.logger.info("");
      this.logger.info("💡 SOLUTIONS");
      this.logger.info("==========================================");
      this.logger.info("• Verify token mint address is a valid PublicKey");
      this.logger.info("• Verify pool program ID is a valid PublicKey");
      this.logger.info("• Check addresses for typos or formatting issues");

      if (error instanceof Error && error.stack) {
        this.logger.debug("\nError stack:");
        this.logger.debug(error.stack);
      }

      throw error;
    }
  }
}

// Create and run the command
const command = new GetPoolSignerCommand();
command.run().catch((error) => {
  process.exit(1);
});