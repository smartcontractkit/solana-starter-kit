/**
 * Token Admin Registry Accept Admin Role Script (CLI Framework Version)
 *
 * This script accepts the administrator role for a token's admin registry.
 * Only the proposed administrator can execute this operation.
 *
 * This is step 2 of the two-step administrator transfer process. The current
 * signer must be the pending administrator that was previously proposed.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TokenRegistryClient } from "../../../ccip-lib/svm/core/client/tokenregistry";
import { ChainId, getCCIPSVMConfig, resolveNetworkConfig, getExplorerUrl } from "../../config";
import { loadKeypair, getKeypairPath } from "../utils";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for admin role acceptance
 */
const MIN_SOL_REQUIRED = 0.01; // Minimum SOL needed for transaction fees

/**
 * Options specific to the accept-admin-role command
 */
interface AcceptAdminRoleOptions extends BaseCommandOptions {
  tokenMint: string;
}

/**
 * Token Admin Registry Accept Admin Role Command
 */
class AcceptAdminRoleCommand extends CCIPCommand<AcceptAdminRoleOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "accept-admin-role",
      description: "✅ CCIP Token Admin Registry Role Acceptor\n\nAccepts the administrator role for a token's admin registry. Only the proposed administrator can execute this operation.",
      examples: [
        "# Accept administrator role (you must be the pending administrator)",
        "yarn svm:admin:accept-admin-role \\",
        "  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        "",
        "# With debug logging",
        "yarn svm:admin:accept-admin-role \\",
        "  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \\",
        "  --log-level DEBUG"
      ],
      notes: [
        "Only the pending administrator can accept the admin role",
        "This is step 2 of a 2-step process - the admin must be proposed first",
        "Router program ID is automatically loaded from CCIP configuration",
        "Role acceptance requires SOL for transaction fees",
        "Use 'yarn svm:admin:propose-administrator' for step 1 of the process",
        "Once accepted, you become the administrator and can manage the token's CCIP settings"
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
      }
    ];
  }

  protected async execute(): Promise<void> {
    this.logger.info("CCIP Token Admin Registry - Accept Admin Role");
    this.logger.info("======================================================");

    // Resolve network configuration based on options
    const config = resolveNetworkConfig(this.options);

    // Get keypair path and load wallet
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Router Program: ${config.routerProgramId.toString()}`);
    this.logger.info(`Wallet: ${walletKeypair.publicKey.toString()}`);

    // Convert token mint string to PublicKey
    let tokenMint: PublicKey;
    try {
      tokenMint = new PublicKey(this.options.tokenMint);
    } catch (error) {
      throw new Error(`Invalid token mint address: ${this.options.tokenMint}`);
    }

    this.logger.info(`Token Mint: ${tokenMint.toString()}`);

    // Check SOL balance
    this.logger.info("");
    this.logger.info("💰 CHECKING WALLET BALANCE");
    this.logger.info("======================================================");

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
    this.logger.info("======================================================");

    const tokenRegistryClient = TokenRegistryClient.create(
      config.connection,
      walletKeypair,
      config.routerProgramId.toString(),
      {},
      { logLevel: this.options.logLevel }
    );

    // Get current token admin registry
    this.logger.info("📋 Fetching current token admin registry...");
    
    const registry = await tokenRegistryClient.getTokenAdminRegistry(tokenMint);
    
    if (!registry) {
      throw new Error(`No token admin registry found for token ${tokenMint.toString()}. The token must be registered first.`);
    }

    this.logger.info("✅ Token admin registry found!");
    this.logger.info(`Current Administrator: ${registry.administrator.toString()}`);
    this.logger.info(`Pending Administrator: ${registry.pendingAdministrator.toString()}`);

    // Verify that the current wallet is the pending administrator
    if (!registry.pendingAdministrator.equals(walletKeypair.publicKey)) {
      throw new Error(
        `Access denied: You are not the pending administrator for this token.\n` +
        `Pending Administrator: ${registry.pendingAdministrator.toString()}\n` +
        `Your Wallet: ${walletKeypair.publicKey.toString()}\n\n` +
        `Only the pending administrator can accept the admin role.`
      );
    }

    this.logger.info(`✅ Verified: You are the pending administrator`);

    // Check if already the current administrator
    if (registry.administrator.equals(walletKeypair.publicKey)) {
      this.logger.info("ℹ️ You are already the current administrator for this token.");
      this.logger.info("No action needed - role acceptance not required.");
      return;
    }

    // Accept the admin role
    this.logger.info("");
    this.logger.info("🎯 ACCEPTING ADMINISTRATOR ROLE");
    this.logger.info("======================================================");

    this.logger.info("Preparing to accept administrator role...");
    this.logger.info(`Token: ${tokenMint.toString()}`);
    this.logger.info(`New Administrator (you): ${walletKeypair.publicKey.toString()}`);
    this.logger.info(`Previous Administrator: ${registry.administrator.toString()}`);

    try {
      const signature = await tokenRegistryClient.acceptAdminRole({
        tokenMint,
      });

      this.logger.info("");
      this.logger.info("✅ ROLE ACCEPTANCE SUCCESSFUL!");
      this.logger.info("======================================================");
      this.logger.info(`Transaction Signature: ${signature}`);
      this.logger.info(`Explorer URL: ${getExplorerUrl(config.id, signature)}`);

      this.logger.info("");
      this.logger.info("📋 UPDATED REGISTRY INFORMATION");
      this.logger.info("======================================================");
      this.logger.info(`Token Mint: ${tokenMint.toString()}`);
      this.logger.info(`New Administrator: ${walletKeypair.publicKey.toString()}`);
      this.logger.info(`Previous Administrator: ${registry.administrator.toString()}`);

      this.logger.info("");
      this.logger.info("🎉 SUCCESS!");
      this.logger.info("You are now the administrator for this token's CCIP registry.");
      this.logger.info("You can now manage the token's CCIP settings and transfer administration to others.");

      this.logger.info("");
      this.logger.info("📝 NEXT STEPS:");
      this.logger.info("• Use 'yarn svm:admin:set-pool' to configure token pools");
      this.logger.info("• Use 'yarn svm:admin:propose-administrator' to transfer admin rights");
      this.logger.info("• Monitor the token's CCIP operations through the explorer");

    } catch (error) {
      this.logger.error("");
      this.logger.error("❌ FAILED TO ACCEPT ADMINISTRATOR ROLE");
      this.logger.error("======================================================");
      
      if (error instanceof Error) {
        this.logger.error(`Error: ${error.message}`);
        
        // Provide specific guidance for common errors
        if (error.message.includes("unauthorized")) {
          this.logger.error("");
          this.logger.error("💡 TROUBLESHOOTING:");
          this.logger.error("• Ensure you are the pending administrator");
          this.logger.error("• Check that the admin role was properly proposed first");
          this.logger.error("• Verify your wallet keypair is correct");
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
const command = new AcceptAdminRoleCommand();
command.run().catch((error) => {
  // Error handling is already done in the framework
  process.exit(1);
});