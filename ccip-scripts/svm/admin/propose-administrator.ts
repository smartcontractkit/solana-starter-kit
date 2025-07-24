/**
 * Token Admin Registry Propose Administrator Script (CLI Framework Version)
 *
 * This script proposes a new administrator for a token's admin registry.
 * Only the token owner (mint authority) can execute this operation.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenRegistryClient, LogLevel, createLogger } from "../../../ccip-lib/svm";
import { ChainId, getCCIPSVMConfig, resolveNetworkConfig, getExplorerUrl } from "../../config";
import { loadKeypair, getKeypairPath } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for admin proposal
 */
const MIN_SOL_REQUIRED = 0.01; // Minimum SOL needed for transaction fees

/**
 * Options specific to the propose-administrator command
 */
interface ProposeAdministratorOptions extends BaseCommandOptions {
  tokenMint: string;
  newAdmin?: string;
}

/**
 * Token Admin Registry Propose Administrator Command
 */
class ProposeAdministratorCommand extends CCIPCommand<ProposeAdministratorOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "propose-administrator",
      description: "👤 CCIP Token Admin Registry Administrator Proposer\n\nProposes a new administrator for a token's admin registry. Only the token owner (mint authority) can execute this operation.",
      examples: [
        "# Propose yourself as administrator (most common case)",
        "yarn svm:admin:propose-administrator \\",
        "  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        "",
        "# Propose someone else as administrator",
        "yarn svm:admin:propose-administrator \\",
        "  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\",
        "  --new-admin 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T",
        "",
        "# With debug logging",
        "yarn svm:admin:propose-administrator \\",
        "  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\",
        "  --log-level DEBUG"
      ],
      notes: [
        "Only the token mint authority can propose an administrator",
        "Router program ID is automatically loaded from CCIP configuration",
        "If --new-admin is not provided, the current signer will be proposed as admin",
        "This is step 1 of a 2-step process - the proposed admin must accept the role",
        "Proposal requires SOL for transaction fees",
        "Use 'yarn svm:admin:accept-admin-role' for the proposed admin to complete the transfer",
        "Use 'yarn svm:admin:get-registry' to view current registry configuration"
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
        name: "new-admin",
        required: false,
        type: "string",
        description: "Address of the proposed new administrator (defaults to current signer if not provided)",
        example: "8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T"
      }
    ];
  }

  protected async execute(): Promise<void> {
    this.logger.info("CCIP Token Admin Registry - Propose Administrator");
    this.logger.info("=========================================================");

    // Resolve network configuration based on options
    const config = resolveNetworkConfig(this.options);

    // Get keypair path and load wallet
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Router Program: ${config.routerProgramId.toString()}`);
    this.logger.info(`Wallet (Mint Authority): ${walletKeypair.publicKey.toString()}`);

    // Convert token mint string to PublicKey
    let tokenMint: PublicKey;
    try {
      tokenMint = new PublicKey(this.options.tokenMint);
    } catch (error) {
      throw new Error(`Invalid token mint address: ${this.options.tokenMint}`);
    }

    this.logger.info(`Token Mint: ${tokenMint.toString()}`);

    // Determine new admin - use current signer if not provided
    let newAdminPublicKey: PublicKey;
    if (this.options.newAdmin) {
      try {
        newAdminPublicKey = new PublicKey(this.options.newAdmin);
        this.logger.info(`Proposed New Administrator: ${newAdminPublicKey.toString()}`);
      } catch (error) {
        throw new Error(`Invalid new admin address: ${this.options.newAdmin}`);
      }
    } else {
      newAdminPublicKey = walletKeypair.publicKey;
      this.logger.info(`Proposed New Administrator: ${newAdminPublicKey.toString()} (current signer)`);
    }

    // Check SOL balance
    this.logger.info("");
    this.logger.info("💰 CHECKING WALLET BALANCE");
    this.logger.info("=========================================================");

    const solBalance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalanceInSol = solBalance / LAMPORTS_PER_SOL;
    
    this.logger.info(`SOL Balance: ${solBalanceInSol.toFixed(9)} SOL (${solBalance} lamports)`);

    if (solBalanceInSol < MIN_SOL_REQUIRED) {
      throw new Error(
        `Insufficient SOL balance. Need at least ${MIN_SOL_REQUIRED} SOL for transaction fees, but you have ${solBalanceInSol.toFixed(9)} SOL.`
      );
    }

    this.logger.info(`✅ Sufficient balance for transaction fees (minimum: ${MIN_SOL_REQUIRED} SOL)`);

    // Create Token Registry client
    this.logger.info("");
    this.logger.info("🔗 CONNECTING TO TOKEN REGISTRY");
    this.logger.info("=========================================================");

    const tokenRegistryClient = TokenRegistryClient.create(
      config.connection,
      walletKeypair,
      config.routerProgramId.toString(),
      {},
      { logLevel: this.options.logLevel }
    );

    // Check if registry already exists
    this.logger.info("📋 Checking existing token admin registry...");
    
    const existingRegistry = await tokenRegistryClient.getTokenAdminRegistry(tokenMint);
    
    if (existingRegistry) {
      this.logger.info("✅ Token admin registry found!");
      this.logger.info(`Current Administrator: ${existingRegistry.administrator.toString()}`);
      this.logger.info(`Current Pending Administrator: ${existingRegistry.pendingAdministrator.toString()}`);
      
      // Check if already the proposed admin
      if (existingRegistry.pendingAdministrator.equals(newAdminPublicKey)) {
        this.logger.info("");
        this.logger.info("ℹ️ ALREADY PROPOSED");
        this.logger.info("=========================================================");
        this.logger.info(`${newAdminPublicKey.toString()} is already the pending administrator.`);
        this.logger.info("No action needed - use 'yarn svm:admin:accept-admin-role' to complete the transfer.");
        return;
      }
      
      // Check if already the current admin
      if (existingRegistry.administrator.equals(newAdminPublicKey)) {
        this.logger.info("");
        this.logger.info("ℹ️ ALREADY ADMINISTRATOR");
        this.logger.info("=========================================================");
        this.logger.info(`${newAdminPublicKey.toString()} is already the current administrator.`);
        this.logger.info("No action needed - they are already in control of this token's CCIP registry.");
        return;
      }
    } else {
      this.logger.info("📝 No existing registry found - will create new one");
    }

    // Propose the administrator
    this.logger.info("");
    this.logger.info("🎯 PROPOSING ADMINISTRATOR");
    this.logger.info("=========================================================");

    this.logger.info("Preparing to propose administrator...");
    this.logger.info(`Token: ${tokenMint.toString()}`);
    this.logger.info(`Proposed Administrator: ${newAdminPublicKey.toString()}`);
    this.logger.info(`Mint Authority (you): ${walletKeypair.publicKey.toString()}`);

    try {
      const signature = await tokenRegistryClient.proposeAdministrator({
        tokenMint,
        newAdmin: newAdminPublicKey,
      });

      this.logger.info("");
      this.logger.info("✅ ADMINISTRATOR PROPOSAL SUCCESSFUL!");
      this.logger.info("=========================================================");
      this.logger.info(`Transaction Signature: ${signature}`);
      this.logger.info(`Explorer URL: ${getExplorerUrl(config.id, signature)}`);

      this.logger.info("");
      this.logger.info("📋 REGISTRY INFORMATION");
      this.logger.info("=========================================================");
      this.logger.info(`Token Mint: ${tokenMint.toString()}`);
      this.logger.info(`Proposed Administrator: ${newAdminPublicKey.toString()}`);
      this.logger.info(`Registry Created/Updated By: ${walletKeypair.publicKey.toString()}`);

      this.logger.info("");
      this.logger.info("🎉 SUCCESS!");
      this.logger.info(`Administrator proposal completed successfully!`);
      
      if (newAdminPublicKey.equals(walletKeypair.publicKey)) {
        this.logger.info("Since you proposed yourself, you can now accept the role.");
        this.logger.info("");
        this.logger.info("📝 NEXT STEP:");
        this.logger.info(`yarn svm:admin:accept-admin-role --token-mint ${tokenMint.toString()}`);
      } else {
        this.logger.info(`The proposed administrator must now accept the role.`);
        this.logger.info("");
        this.logger.info("📝 NEXT STEP FOR THE PROPOSED ADMIN:");
        this.logger.info(`yarn svm:admin:accept-admin-role --token-mint ${tokenMint.toString()}`);
        this.logger.info(`(Must be run by: ${newAdminPublicKey.toString()})`);
      }

    } catch (error) {
      this.logger.error("");
      this.logger.error("❌ FAILED TO PROPOSE ADMINISTRATOR");
      this.logger.error("=========================================================");
      
      if (error instanceof Error) {
        this.logger.error(`Error: ${error.message}`);
        
        // Provide specific guidance for common errors
        if (error.message.includes("unauthorized") || error.message.includes("mint authority")) {
          this.logger.error("");
          this.logger.error("💡 TROUBLESHOOTING:");
          this.logger.error("• Ensure you are the mint authority for this token");
          this.logger.error("• Verify your wallet keypair is correct");
          this.logger.error("• Check that the token mint address is valid");
        } else if (error.message.includes("insufficient")) {
          this.logger.error("");
          this.logger.error("💡 TROUBLESHOOTING:");
          this.logger.error("• Ensure you have enough SOL for transaction fees");
          this.logger.error("• Try with a higher gas fee");
        }
      } else {
        this.logger.error(`Unexpected error: ${String(error)}`);
      }
      
      throw error;
    }
  }
}

// Create and run the command
const command = new ProposeAdministratorCommand();
command.run().catch((error) => {
  // Error handling is already done in the framework
  process.exit(1);
});