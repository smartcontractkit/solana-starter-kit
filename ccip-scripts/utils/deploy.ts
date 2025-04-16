import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import * as path from "path";
import { loadKeypair } from "./provider";

// Constants
const DEFAULT_KEYPAIR_PATH = path.resolve(
  process.env.HOME || "",
  ".config/solana/keytest.json"
);

// These would typically come from a config, but to avoid circular dependencies, define them here
const PROGRAM_ID = new PublicKey(
  "52XvWQKuZHRjnR7qHsEGE532jqgQ3MBiBMgVkBowP1LD"
);
const ROUTER_ID = new PublicKey("Ccip8ZTcM2qHjVt8FYHtuCAqjc637yLKnsJ5q5r2e6eL");

// Setup provider and program
export async function deploy() {
  // Configure the client to use devnet
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  console.log("Loading keypair from ~/.config/solana/keytest.json...");
  // Load the wallet keypair from file
  const walletKeypair = loadKeypair(DEFAULT_KEYPAIR_PATH);

  console.log("Wallet public key:", walletKeypair.publicKey.toString());

  // Check account balance
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.log("Warning: Low balance. Might not be enough for deployment.");
    console.log("Request airdrop from Solana devnet faucet before proceeding.");
    process.exit(1);
  }

  console.log("Program ID:", PROGRAM_ID.toString());
  console.log("Router ID:", ROUTER_ID.toString());

  console.log("Deploying aem-ccip-receiver program to devnet...");
  try {
    // This command will build and deploy only the aem-ccip-receiver program to devnet
    const output = require("child_process")
      .execSync(
        "anchor deploy --program-name aem_ccip_receiver --provider.cluster devnet --provider.wallet ~/.config/solana/keytest.json"
      )
      .toString();
    console.log(output);
    console.log("Program deployed successfully!");
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  deploy().then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    }
  );
}
