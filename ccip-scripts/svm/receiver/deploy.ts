import { PublicKey, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { createLogger, LogLevel } from "../../../ccip-lib/svm";
import { getCCIPSVMConfig, ChainId } from "../../config";
import { loadKeypair } from "../utils";
import { KEYPAIR_PATHS } from "../utils/config-parser";

/**
 * Deploys the CCIP Basic Receiver program to Solana devnet.
 * Checks balance and executes the deployment command directly.
 */
async function main() {
  // Create logger
  const logger = createLogger("ccip-receiver-deploy", { level: LogLevel.INFO });
  logger.info("CCIP Basic Receiver Deployment");

  // Load configuration
  const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);
  const connection = config.connection;

  // Find the local IDL file
  const idlPath = path.join(
    __dirname,
    "../../../target/idl/ccip_basic_receiver.json"
  );

  if (!fs.existsSync(idlPath)) {
    logger.error(`IDL file not found at ${idlPath}`);
    logger.error("Please build the program first with 'anchor build'");
    process.exit(1);
  }

  // Read the IDL file
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

  // Get program ID from IDL - checking both locations
  if (!idl.address && (!idl.metadata || !idl.metadata.address)) {
    logger.error("Program ID not found in IDL");
    logger.error("Please build the program first with 'anchor build'");
    process.exit(1);
  }

  // Use the address directly if available, otherwise use metadata.address
  const programId = new PublicKey(idl.address || idl.metadata.address);

  logger.info(`Program ID from IDL: ${programId.toString()}`);
  logger.info(`Program Name: ${idl.metadata.name}`);

  // Default keypair path
  const keypairPath = process.env.KEYPAIR_PATH || KEYPAIR_PATHS.DEFAULT;
  logger.info(`Loading keypair from ${keypairPath}...`);

  // Load the wallet keypair from file
  try {
    const walletKeypair = loadKeypair(keypairPath);
    logger.info(`Wallet public key: ${walletKeypair.publicKey.toString()}`);

    // Check account balance
    const balance = await connection.getBalance(walletKeypair.publicKey);
    logger.info(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 0.5 * LAMPORTS_PER_SOL) {
      logger.warn("Warning: Low balance. Might not be enough for deployment.");
      logger.warn(
        "Request airdrop from Solana devnet faucet before proceeding."
      );
      logger.info("You can request an airdrop with:");
      logger.info(
        `solana airdrop 1 ${walletKeypair.publicKey.toString()} --url devnet`
      );
      process.exit(1);
    }

    // Deploy the program
    logger.info(`Deploying ${idl.name} program to devnet...`);

    try {
      const deployCommand = `anchor deploy --program-name ccip-basic-receiver --provider.cluster devnet --provider.wallet ${keypairPath}`;
      logger.info(`Running: ${deployCommand}`);

      const output = execSync(deployCommand).toString();
      logger.info(output);
      logger.info("Program deployed successfully!");

      // Next steps
      logger.info("\n======== NEXT STEPS ========");
      logger.info("Initialize the program with:");
      logger.info("npx ts-node ccip-scripts/svm/receiver/initialize.ts");
    } catch (error) {
      logger.error("Deployment failed:", error);
      process.exit(1);
    }
  } catch (error) {
    logger.error("Error loading keypair:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
