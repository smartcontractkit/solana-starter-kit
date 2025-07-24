/**
 * SOL to wSOL Wrapper Utility (CLI Framework Version)
 *
 * This script wraps native SOL to wSOL (Wrapped SOL), which is necessary for
 * using SOL in token operations that require SPL Token compatibility.
 *
 * The amounts are expressed in lamports (absolute raw values), not SOL units,
 * 1 SOL = 1,000,000,000 lamports
 */

import {
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { loadKeypair, getKeypairPath } from "../utils";
import { ChainId, getCCIPSVMConfig, resolveNetworkConfig } from "../../config";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for SOL wrapping operations
 */
const WRAP_SOL_CONFIG = {
  // Default amount of lamports to wrap (absolute raw value)
  // 100,000,000 lamports = 0.1 SOL
  defaultAmount: "100000000",
  // Description for token information
  tokenDescription: "Wrapped SOL (wSOL)",
};

/**
 * Options specific to the wrap-sol command
 */
interface WrapSolOptions extends BaseCommandOptions {
  amount: string;
}

/**
 * Result of SOL wrapping operation
 */
interface WrapSolResult {
  signature: string;
  amountWrapped: bigint;
  newWsolBalance: string;
}

/**
 * SOL to wSOL Wrapper Command
 */
class WrapSolCommand extends CCIPCommand<WrapSolOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "wrap-sol",
      description: "🔄 SOL to wSOL Wrapper Utility\n\nWraps native SOL to wSOL (Wrapped SOL), which is necessary for using SOL in token operations that require SPL Token compatibility.",
      examples: [
        "# Wrap default amount (0.1 SOL = 100,000,000 lamports)",
        "yarn svm:token:wrap",
        "",
        "# Wrap specific amount in lamports",
        "yarn svm:token:wrap --amount 500000000  # 0.5 SOL",
        "",
        "# With custom network and logging",
        "yarn svm:token:wrap --amount 200000000 --network devnet --log-level DEBUG"
      ],
      notes: [
        "Amounts are expressed in lamports (1 SOL = 1,000,000,000 lamports)",
        "Creates wSOL ATA if it doesn't exist",
        "Uses system transfer + sync native instruction for efficiency",
        "Verifies sufficient SOL balance before wrapping"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "amount",
        type: "string",
        description: "Amount of lamports to wrap (default: 100000000 = 0.1 SOL)",
        defaultValue: WRAP_SOL_CONFIG.defaultAmount,
        example: "500000000"
      }
    ];
  }

  /**
   * Wraps SOL to wSOL token using absolute lamport values
   */
  private async wrapSolToToken(
    lamports: string | number | bigint,
    connection: any,
    walletKeypair: any
  ): Promise<WrapSolResult> {
    // Convert lamports to BigInt to handle large numbers safely
    const lamportsBigInt = BigInt(lamports);

    // Convert to SOL for display purposes only
    const solAmount = Number(lamportsBigInt) / LAMPORTS_PER_SOL;

    this.logger.info(
      `Wrapping ${lamportsBigInt.toString()} lamports (${solAmount.toFixed(
        9
      )} SOL) to wSOL...`
    );

    // Check SOL balance
    const solBalance = await connection.getBalance(walletKeypair.publicKey);
    const solBalanceDisplay = solBalance / LAMPORTS_PER_SOL;
    this.logger.info(
      `Current SOL Balance: ${solBalance} lamports (${solBalanceDisplay.toFixed(
        9
      )} SOL)`
    );

    if (solBalance < Number(lamportsBigInt)) {
      throw new Error(
        `Not enough SOL. Need at least ${lamportsBigInt.toString()} lamports, but you have ${solBalance} lamports.`
      );
    }

    // Get the associated token account for wSOL
    const wsolAccount = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      walletKeypair.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );

    this.logger.info(`wSOL Account: ${wsolAccount.toString()}`);

    const transaction = new Transaction();

    // Check if the wSOL account already exists
    let accountExists = false;
    let currentWsolBalance = BigInt(0);

    try {
      const accountInfo = await getAccount(
        connection,
        wsolAccount,
        undefined,
        TOKEN_PROGRAM_ID
      );
      accountExists = true;
      currentWsolBalance = accountInfo.amount;
      this.logger.info(`Current wSOL balance: ${currentWsolBalance.toString()} lamports`);
    } catch (error) {
      this.logger.info("wSOL account doesn't exist. Will create it.");
      accountExists = false;
    }

    // If the account doesn't exist, create it
    if (!accountExists) {
      const createAccountInstruction = createAssociatedTokenAccountInstruction(
        walletKeypair.publicKey, // payer
        wsolAccount, // associated token account
        walletKeypair.publicKey, // owner
        NATIVE_MINT, // mint
        TOKEN_PROGRAM_ID
      );
      transaction.add(createAccountInstruction);
      this.logger.info("Adding instruction to create wSOL account...");
    } else {
      this.logger.info("wSOL account exists. Proceeding with wrapping...");
    }

    // Transfer SOL to the wSOL account
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: walletKeypair.publicKey,
      toPubkey: wsolAccount,
      lamports: Number(lamportsBigInt),
    });
    transaction.add(transferInstruction);

    // Sync native instruction to update the wSOL balance
    const syncNativeInstruction = createSyncNativeInstruction(
      wsolAccount,
      TOKEN_PROGRAM_ID
    );
    transaction.add(syncNativeInstruction);

    this.logger.info("Sending transaction...");

    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair],
      {
        skipPreflight: this.options.skipPreflight,
        commitment: "confirmed",
      }
    );

    // Calculate new balance
    const newWsolBalance = currentWsolBalance + lamportsBigInt;
    const newWsolBalanceDisplay = Number(newWsolBalance) / LAMPORTS_PER_SOL;

    return {
      signature,
      amountWrapped: lamportsBigInt,
      newWsolBalance: `${newWsolBalance.toString()} lamports (${newWsolBalanceDisplay.toFixed(9)} ${WRAP_SOL_CONFIG.tokenDescription})`,
    };
  }

  protected async execute(): Promise<void> {
    this.logger.info("");
    this.logger.info("==== Environment Information ====");

    // Resolve network configuration based on options
    const config = resolveNetworkConfig(this.options);
    this.logger.info(`Solana Cluster: ${this.options.network}`);

    // Get keypair path and load wallet
    const keypairPath = getKeypairPath(this.options);
    this.logger.info(`Keypair Path: ${keypairPath}`);
    const walletKeypair = loadKeypair(keypairPath);
    this.logger.info(`Wallet public key: ${walletKeypair.publicKey.toString()}`);

    this.logger.info("");
    this.logger.info("==== Wallet Balance Information ====");

    // Check SOL balance first
    const solBalance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalanceDisplay = solBalance / LAMPORTS_PER_SOL;
    this.logger.info(
      `SOL Balance: ${solBalance} lamports (${solBalanceDisplay.toFixed(9)} SOL)`
    );

    this.logger.info("");
    this.logger.info(
      `You are about to wrap ${this.options.amount} lamports to ${WRAP_SOL_CONFIG.tokenDescription}`
    );
    this.logger.info(
      "This operation will convert native SOL to SPL token format required for token operations."
    );

    this.logger.info("");
    this.logger.info("==== Wrapping SOL to wSOL ====");

    try {
      const result = await this.wrapSolToToken(
        this.options.amount,
        config.connection,
        walletKeypair
      );

      this.logger.info("✅ Transaction successful!");
      this.logger.info(`SOL wrapped to wSOL: ${result.amountWrapped.toString()} lamports`);
      this.logger.info(`New wSOL balance: ${result.newWsolBalance}`);

      this.logger.info("");
      this.logger.info("==== Transaction Details ====");
      this.logger.info(`Transaction signature: ${result.signature}`);
      this.logger.info(
        `Explorer URL: ${config.explorerUrl}${result.signature}?cluster=${this.options.network}`
      );

      this.logger.info("");
      this.logger.info("==== Operation Summary ====");
      this.logger.info(`Token: ${WRAP_SOL_CONFIG.tokenDescription}`);
      this.logger.info(`Amount Wrapped: ${result.amountWrapped.toString()} lamports`);
      this.logger.info(`New Balance: ${result.newWsolBalance.split(' ')[0]} lamports`);

      this.logger.info("");
      this.logger.info("SOL wrapping completed successfully");

    } catch (error) {
      this.logger.error("❌ Failed to wrap SOL:");
      if (error instanceof Error) {
        this.logger.error(error.message);
      } else {
        this.logger.error(String(error));
      }
      throw error;
    }
  }
}

// Create and run the command
const command = new WrapSolCommand();
command.run().catch((error) => {
  // Error handling is already done in the framework
  process.exit(1);
});