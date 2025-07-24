/**
 * CCIP Basic Receiver Program Deployment Script (CLI Framework Version)
 *
 * This script deploys the CCIP Basic Receiver program to Solana devnet.
 * It checks balance requirements and executes the deployment command.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { resolveNetworkConfig } from "../../config";
import { getKeypairPath, loadKeypair } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for deployment operations
 */
const DEPLOY_CONFIG = {
  programName: "ccip-basic-receiver",
  idlFileName: "ccip_basic_receiver.json",
  minSolRequired: 0.5,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the deploy command
 */
interface DeployOptions extends BaseCommandOptions {
  // No additional options needed for deployment
}

/**
 * CCIP Basic Receiver Deployment Command
 */
class DeployCommand extends CCIPCommand<DeployOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "deploy",
      description: "🚀 CCIP Basic Receiver Deployment\\\\n\\\\nDeploys the CCIP Basic Receiver program to Solana devnet. Checks balance requirements and executes the deployment command using Anchor.",
      examples: [
        "# Deploy the CCIP Basic Receiver program",
        "yarn svm:receiver:deploy",
        "",
        "# Deploy with debug logging",
        "yarn svm:receiver:deploy --log-level DEBUG",
        "",
        "# Deploy with custom keypair",
        "yarn svm:receiver:deploy --keypair ~/.config/solana/my-keypair.json"
      ],
      notes: [
        `Program name: ${DEPLOY_CONFIG.programName}`,
        `Minimum ${DEPLOY_CONFIG.minSolRequired} SOL required for deployment`,
        "Program must be built first with 'anchor build'",
        "IDL file must exist in target/idl/ directory",
        "Deployment uses Anchor CLI under the hood",
        "After deployment, initialize the program with 'yarn svm:receiver:initialize'",
        "Use 'solana airdrop' command if balance is insufficient"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      // No specific arguments needed for deployment
    ];
  }

  /**
   * Find and validate IDL file
   */
  private findIdlFile(): { idlPath: string; idl: any; programId: PublicKey } {
    const idlPath = path.join(
      __dirname,
      `../../../target/idl/${DEPLOY_CONFIG.idlFileName}`
    );

    if (!fs.existsSync(idlPath)) {
      throw new Error(
        `IDL file not found at ${idlPath}\\n` +
        `Please build the program first with 'anchor build'`
      );
    }

    // Read and parse the IDL file
    let idl: any;
    try {
      idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    } catch (error) {
      throw new Error(
        `Failed to parse IDL file: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Get program ID from IDL
    if (!idl.address && (!idl.metadata || !idl.metadata.address)) {
      throw new Error(
        "Program ID not found in IDL\\n" +
        "Please build the program first with 'anchor build'"
      );
    }

    const programId = new PublicKey(idl.address || idl.metadata.address);

    return { idlPath, idl, programId };
  }

  /**
   * Check wallet balance for deployment
   */
  private async checkBalance(walletPublicKey: PublicKey, config: any): Promise<number> {
    const balance = await config.connection.getBalance(walletPublicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;

    this.logger.info(`Wallet balance: ${balance} lamports (${solBalance.toFixed(9)} SOL)`);

    if (solBalance < DEPLOY_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient balance for deployment\\n` +
        `Required: ${DEPLOY_CONFIG.minSolRequired} SOL\\n` +
        `Current: ${solBalance.toFixed(9)} SOL\\n\\n` +
        `Request airdrop with:\\n` +
        `solana airdrop 1 ${walletPublicKey.toString()} --url devnet`
      );
    }

    return solBalance;
  }

  /**
   * Execute the deployment command
   */
  private deployProgram(keypairPath: string): string {
    const deployCommand = `anchor deploy --program-name ${DEPLOY_CONFIG.programName} --provider.cluster devnet --provider.wallet ${keypairPath}`;
    
    this.logger.info(`Executing deployment command:`);
    this.logger.info(`${deployCommand}`);

    try {
      const output = execSync(deployCommand, { 
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 // 1MB buffer for large outputs
      });
      return output;
    } catch (error) {
      throw new Error(
        `Deployment failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  protected async execute(): Promise<void> {
    this.logger.info("🚀 CCIP Basic Receiver Deployment");
    this.logger.info("==========================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Wallet: ${walletKeypair.publicKey.toString()}`);
    this.logger.info(`Keypair path: ${keypairPath}`);

    // Find and validate IDL file
    this.logger.info("");
    this.logger.info("📋 PROGRAM INFORMATION");
    this.logger.info("==========================================");
    const { idlPath, idl, programId } = this.findIdlFile();
    
    this.logger.info(`IDL file: ${idlPath}`);
    this.logger.info(`Program ID: ${programId.toString()}`);
    this.logger.info(`Program name: ${idl.metadata?.name || idl.name || 'Unknown'}`);

    // Check wallet balance
    this.logger.info("");
    this.logger.info("💰 WALLET BALANCE CHECK");
    this.logger.info("==========================================");
    const solBalance = await this.checkBalance(walletKeypair.publicKey, config);

    // Execute deployment
    this.logger.info("");
    this.logger.info("🔧 DEPLOYING PROGRAM");
    this.logger.info("==========================================");
    this.logger.info(`Deploying ${DEPLOY_CONFIG.programName} to devnet...`);
    
    const deployOutput = this.deployProgram(keypairPath);
    
    // Display deployment results
    this.logger.info("");
    this.logger.info("📄 DEPLOYMENT OUTPUT");
    this.logger.info("==========================================");
    this.logger.info(deployOutput);

    // Success message and next steps
    this.logger.info("");
    this.logger.info("✅ DEPLOYMENT SUCCESSFUL");
    this.logger.info("==========================================");
    this.logger.info(`Program: ${DEPLOY_CONFIG.programName}`);
    this.logger.info(`Program ID: ${programId.toString()}`);
    this.logger.info(`Deployed to: devnet`);
    this.logger.info(`Used balance: ~${(solBalance - (await config.connection.getBalance(walletKeypair.publicKey)) / LAMPORTS_PER_SOL).toFixed(6)} SOL`);

    this.logger.info("");
    this.logger.info("📋 NEXT STEPS");
    this.logger.info("==========================================");
    this.logger.info("1. Initialize the deployed program:");
    this.logger.info("   yarn svm:receiver:initialize");
    this.logger.info("");
    this.logger.info("2. Test message reception:");
    this.logger.info("   yarn svm:receiver:get-latest-message");
    this.logger.info("");
    this.logger.info("3. When done, optionally close storage:");
    this.logger.info("   yarn svm:receiver:close-storage");

    this.logger.info("");
    this.logger.info("🎉 Deployment Complete!");
    this.logger.info(`✅ Program deployed successfully to devnet`);
    this.logger.info(`✅ Program ID: ${programId.toString()}`);
  }
}

// Create and run the command
const command = new DeployCommand();
command.run().catch((error) => {
  process.exit(1);
});
