import {
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  Connection,
  TransactionInstruction,
  Signer,
} from "@solana/web3.js";
import {
  createApproveInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  loadKeypair,
  getKeypairPath,
  parseCommonArgs,
  printUsage,
} from "../utils";
import { detectTokenProgram } from "../../../ccip-lib/svm";
import {
  findFeeBillingSignerPDA,
  findExternalTokenPoolsSignerPDA,
  findDynamicTokenPoolsSignerPDA,
} from "../../../ccip-lib/svm/utils/pdas";
import { ChainId, getCCIPSVMConfig } from "../../config";
import { LogLevel, createLogger, Logger } from "../../../ccip-lib/svm";

/**
 * IMPORTANT NOTE: All tokens that will be used in ccip_send transactions
 * MUST be delegated to the "fee-billing" signer PDA. This includes any tokens
 * that will be transferred across chains (not just fee tokens).
 * 
 * This is because the ccip-router program's implementation always uses the
 * fee_billing_signer PDA to move tokens from the user's account to the token pool,
 * regardless of the token type or purpose.
 */

// =================================================================
// CONSTANTS
// =================================================================

// Maximum uint64 value for unlimited approvals - computes 2^64 - 1
const MAX_UINT64 = ((BigInt(1) << BigInt(64)) - BigInt(1)).toString();

// Get configuration - we only support Solana Devnet for now
const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);

// =================================================================
// TYPES
// =================================================================

/**
 * Delegation type determines which PDA will be used for delegation
 */
type DelegationType = "fee-billing" | "token-pool" | "custom";

/**
 * Token delegation configuration interface
 */
interface TokenDelegationConfig {
  tokenMint: PublicKey | string;
  tokenProgramId?: PublicKey | string; // Optional - will be determined dynamically if not provided
  delegationType: DelegationType;
  customDelegate?: PublicKey | string; // Optional custom delegate address
  amount: string;
}

/**
 * Extended options for token delegation operations
 */
interface TokenDelegateOptions extends ReturnType<typeof parseCommonArgs> {
  // For custom token delegation
  tokenMint?: string;
  tokenProgramId?: string | PublicKey;
  delegationType?: DelegationType;
  customDelegate?: string | PublicKey;
}

// =================================================================
// CONFIGURATION
// =================================================================

/**
 * Token delegation configuration for commonly used tokens
 */
const TOKEN_DELEGATION_CONFIG = {
  // Tokens to delegate
  tokenDelegations: [
    {
      // Wrapped SOL (wSOL)
      tokenMint: NATIVE_MINT,
      // Will determine program ID dynamically, but we know it uses the legacy TOKEN_PROGRAM_ID
      delegationType: "fee-billing" as DelegationType, // Maps to fee billing signer PDA
      amount: MAX_UINT64, // Unlimited approval
    },
    {
      // BnM token
      tokenMint: config.bnmTokenMint,
      // Will determine program ID dynamically
      delegationType: "fee-billing" as DelegationType, // Must use fee-billing PDA for ccip_send compatibility
      amount: MAX_UINT64, // Unlimited approval
    },
    {
      // LINK token
      tokenMint: config.linkTokenMint,
      // Will determine program ID dynamically
      delegationType: "fee-billing" as DelegationType, // Maps to fee billing signer PDA
      amount: MAX_UINT64, // Unlimited approval
    },
  ],
};

/**
 * Script configuration parameters
 */
const SCRIPT_CONFIG = {
  computeUnits: 1_400_000, // Maximum compute units for Solana
  minSolRequired: 0.001, // Minimum SOL needed for transaction fees
  retries: 5, // Number of retries for transaction confirmation
};

// =================================================================
// HELPER FUNCTIONS
// =================================================================

/**
 * Parse command line arguments for token delegation operations
 * @returns Parsed token delegation options
 */
function parseTokenDelegateArgs(): TokenDelegateOptions {
  const commonOptions = parseCommonArgs();
  const args = process.argv.slice(2);
  const options: TokenDelegateOptions = {
    ...commonOptions,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--token-mint" && i + 1 < args.length) {
      options.tokenMint = args[i + 1];
      i++;
    } else if (args[i] === "--token-program-id" && i + 1 < args.length) {
      options.tokenProgramId = args[i + 1];
      i++;
    } else if (args[i] === "--delegation-type" && i + 1 < args.length) {
      const delegationType = args[i + 1].toLowerCase();
      if (
        delegationType === "fee-billing" ||
        delegationType === "token-pool" ||
        delegationType === "custom"
      ) {
        options.delegationType = delegationType as DelegationType;
      } else {
        console.warn(
          `Unknown delegation type: ${delegationType}, using token-pool`
        );
        options.delegationType = "token-pool";
      }
      i++;
    } else if (args[i] === "--custom-delegate" && i + 1 < args.length) {
      options.customDelegate = args[i + 1];
      i++;
    }
  }

  return options;
}

/**
 * Checks if a token account exists and creates it if it doesn't
 * 
 * This function is crucial for beginners to understand as Associated Token Accounts (ATAs)
 * are required to hold SPL tokens. An ATA is a deterministic account address derived
 * from the owner's wallet and token mint using the formula:
 * 
 * ATA = PDA(owner, token_program, mint)
 * 
 * The function:
 * 1. Calculates the expected ATA address using getAssociatedTokenAddressSync
 * 2. Checks if the account already exists on-chain via getAccountInfo
 * 3. If it doesn't exist, creates an instruction to initialize it
 * 4. Returns both the creation instructions and existence status
 * 
 * @param connection Solana RPC connection for on-chain account lookups
 * @param tokenMint The token mint address (defines which token type)
 * @param owner The wallet that will own the token account
 * @param tokenProgramId Either TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID
 * @param logger Logger instance for debugging and informational messages
 * @returns Object containing creation instructions (if needed) and existence boolean
 * 
 * @example
 * ```typescript
 * const { createATAInstructions, ataExists } = await checkAndCreateTokenAccount(
 *   connection,
 *   new PublicKey("TokenMint111111111111111111111111111111111"),
 *   wallet.publicKey,
 *   TOKEN_2022_PROGRAM_ID,
 *   logger
 * );
 * // If ataExists === false, createATAInstructions contains the creation instruction
 * ```
 */
async function checkAndCreateTokenAccount(
  connection: Connection,
  tokenMint: PublicKey,
  owner: PublicKey,
  tokenProgramId: PublicKey,
  logger: Logger
): Promise<{ createATAInstructions: TransactionInstruction[], ataExists: boolean }> {
  // Get the Associated Token Account address
  const tokenAccount = getAssociatedTokenAddressSync(
    tokenMint,
    owner,
    false,
    tokenProgramId
  );

  let createATAInstructions: TransactionInstruction[] = [];
  let ataExists = false;

  try {
    // Check if the token account exists
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    ataExists = accountInfo !== null;
    
    if (!ataExists) {
      logger.info(`Token account ${tokenAccount.toString()} does not exist. Adding instruction to create it.`);
      // If the token account doesn't exist, add an instruction to create it
      createATAInstructions.push(
        createAssociatedTokenAccountInstruction(
          owner, // payer
          tokenAccount, // associated token account address
          owner, // owner
          tokenMint, // mint
          tokenProgramId // token program ID
        )
      );
    } else {
      logger.info(`Token account ${tokenAccount.toString()} exists.`);
    }
  } catch (error) {
    logger.error(`Error checking token account: ${error instanceof Error ? error.message : String(error)}`);
    // Assume it doesn't exist and try to create it
    createATAInstructions.push(
      createAssociatedTokenAccountInstruction(
        owner,
        tokenAccount,
        owner,
        tokenMint,
        tokenProgramId
      )
    );
  }

  return { createATAInstructions, ataExists };
}

/**
 * Resolve a delegate address based on delegation type and token mint
 *
 * @param delegationType Type of delegation (fee-billing, token-pool, custom)
 * @param routerProgramId Router program ID
 * @param tokenMint Token mint address
 * @param customDelegate Custom delegate address (optional)
 * @param connection Solana connection (optional)
 * @returns Resolved delegate public key
 */
async function resolveDelegateAddress(
  delegationType: DelegationType,
  routerProgramId: PublicKey,
  tokenMint: PublicKey,
  customDelegate?: PublicKey | string,
  connection?: Connection
): Promise<PublicKey> {
  switch (delegationType) {
    case "fee-billing": {
      const [feeBillingSignerPDA] = findFeeBillingSignerPDA(routerProgramId);
      return feeBillingSignerPDA;
    }
    case "token-pool": {
      try {
        if (!connection) {
          throw new Error("Connection required for token-pool delegation type");
        }
        // Try to find dynamic token pool signer PDA
        const [tokenPoolSignerPDA] = await findDynamicTokenPoolsSignerPDA(
          tokenMint,
          routerProgramId,
          connection
        );
        return tokenPoolSignerPDA;
      } catch (error) {
        // Fall back to static token pool signer PDA if dynamic lookup fails
        const [tokenPoolsSignerPDA] =
          findExternalTokenPoolsSignerPDA(routerProgramId);
        return tokenPoolsSignerPDA;
      }
    }
    case "custom": {
      if (!customDelegate) {
        throw new Error(
          "Custom delegate address required for custom delegation type"
        );
      }
      return customDelegate instanceof PublicKey
        ? customDelegate
        : new PublicKey(customDelegate);
    }
    default:
      throw new Error(`Unknown delegation type: ${delegationType}`);
  }
}

/**
 * Processes a single token delegation
 * 
 * @param delegation Token delegation configuration
 * @param walletKeypair Wallet keypair for signing transactions
 * @param routerProgramId Router program ID
 * @param connection Solana connection
 * @param logger Logger instance
 * @param options Additional options for the delegation
 */
async function processTokenDelegation(
  delegation: TokenDelegationConfig,
  walletKeypair: Signer,
  routerProgramId: PublicKey,
  connection: Connection,
  logger: Logger,
  options: TokenDelegateOptions
): Promise<void> {
  try {
    // Convert tokenMint to PublicKey
    const tokenMint =
      delegation.tokenMint instanceof PublicKey
        ? delegation.tokenMint
        : new PublicKey(delegation.tokenMint.toString());

    // Convert tokenProgramId to PublicKey or determine dynamically
    let tokenProgramId: PublicKey;
    if (delegation.tokenProgramId) {
      tokenProgramId =
        delegation.tokenProgramId instanceof PublicKey
          ? delegation.tokenProgramId
          : new PublicKey(delegation.tokenProgramId.toString());
      logger.info(
        `Using provided token program ID: ${tokenProgramId.toString()}`
      );
    } else {
      // Dynamically determine token program ID from the mint account
      tokenProgramId = await detectTokenProgram(
        tokenMint,
        connection,
        logger
      );
    }

    // Resolve delegate address based on delegation type
    const delegateAddress = await resolveDelegateAddress(
      delegation.delegationType,
      routerProgramId,
      tokenMint,
      delegation.customDelegate,
      connection
    );

    const amountToDelegate = BigInt(delegation.amount);

    logger.info(`Token Program ID: ${tokenProgramId.toString()}`);
    logger.info(`Delegation Type: ${delegation.delegationType}`);
    logger.info(`Delegate Address: ${delegateAddress.toString()}`);
    logger.info(`Amount to delegate: ${amountToDelegate.toString()}`);

    // Get the user's token account
    const userTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      walletKeypair.publicKey,
      false,
      tokenProgramId
    );

    logger.info(`User Token Account: ${userTokenAccount.toString()}`);

    // Check if the token account exists and create it if it doesn't
    const { createATAInstructions, ataExists } = await checkAndCreateTokenAccount(
      connection,
      tokenMint,
      walletKeypair.publicKey,
      tokenProgramId,
      logger
    );

    // Create the approve instruction
    const approveInstruction = createApproveInstruction(
      userTokenAccount,
      delegateAddress,
      walletKeypair.publicKey,
      amountToDelegate,
      [],
      tokenProgramId
    );

    // Get a recent blockhash with longer validity
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash({
      commitment: "finalized"
    });

    // Create and send transaction
    const transaction = new Transaction({
      feePayer: walletKeypair.publicKey,
      blockhash,
      lastValidBlockHeight
    });
    
    // Add create ATA instruction if needed
    if (createATAInstructions.length > 0) {
      transaction.add(...createATAInstructions);
    }
    
    // Add approve instruction
    transaction.add(approveInstruction);

    logger.info("Sending transaction to delegate token authority...");
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair],
      { 
        skipPreflight: options.skipPreflight, 
        commitment: "confirmed",
        maxRetries: SCRIPT_CONFIG.retries,
        preflightCommitment: "processed"
      }
    );

    logger.info(`✅ Token delegation successful!`);
    logger.info(`Transaction signature: ${signature}`);
    logger.info(
      `Explorer URL: https://explorer.solana.com/tx/${signature}?cluster=devnet`
    );
  } catch (error) {
    logger.error(
      `❌ Error delegating token authority:`,
      error instanceof Error ? error.message : String(error)
    );

    if (error instanceof Error && error.stack) {
      logger.debug("Error stack:");
      logger.debug(error.stack);
    }
  }
}

/**
 * Main token delegation function
 */
async function delegateTokenAuthority(): Promise<void> {
  try {
    // Parse command line arguments
    const cmdOptions = parseTokenDelegateArgs();

    // Create logger with appropriate level
    const logger = createLogger("token-delegate", {
      level: cmdOptions.logLevel ?? LogLevel.INFO,
    });

    // Display environment information
    logger.info("\n==== Environment Information ====");
    logger.info(`Solana Cluster: devnet`);

    // Get appropriate keypair path
    const keypairPath = getKeypairPath(cmdOptions);
    logger.info(`Keypair Path: ${keypairPath}`);

    // Load wallet keypair
    const walletKeypair = loadKeypair(keypairPath);
    logger.info(`Wallet public key: ${walletKeypair.publicKey.toString()}`);

    // Get router program ID from config
    const routerProgramId = config.routerProgramId;
    logger.info(`Router Program ID: ${routerProgramId.toString()}`);

    // Check wallet SOL balance
    logger.info("\n==== Wallet Balance Information ====");
    const connection = config.connection;
    const balance = await connection.getBalance(walletKeypair.publicKey);
    logger.info(`SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    logger.info(`Lamports Balance: ${balance} lamports`);

    // Check if we have enough SOL
    if (balance < SCRIPT_CONFIG.minSolRequired * LAMPORTS_PER_SOL) {
      logger.error(
        `Insufficient SOL balance. You need at least ${SCRIPT_CONFIG.minSolRequired} SOL for transaction fees.`
      );
      return;
    }

    // Process each token delegation from config
    logger.info("\n==== Processing Token Delegations ====");

    let tokenDelegations: TokenDelegationConfig[] = [];

    // If custom token mints are provided, use them instead of defaults
    if (cmdOptions.tokenMint) {
      // Support comma-separated token mints
      const tokenMints = cmdOptions.tokenMint.split(',').map(mint => mint.trim());
      
      logger.info(`Custom token mints provided: ${tokenMints.join(', ')}`);
      logger.info("Using custom tokens instead of defaults");

      let effectiveDelegationType: DelegationType = "fee-billing"; // Default for ccip_send compatibility
      let customDelegateAddress: PublicKey | string | undefined = undefined;
      
      if (cmdOptions.delegationType === "custom") {
        if (!cmdOptions.customDelegate) {
          logger.error("Error: --delegation-type 'custom' requires --custom-delegate to be set.");
          throw new Error("Custom delegate not provided for custom delegation type.");
        }
        effectiveDelegationType = "custom";
        customDelegateAddress = cmdOptions.customDelegate;
        logger.info(`Using custom delegation type for all provided tokens.`);
      } else if (cmdOptions.delegationType === "token-pool") {
        // If user explicitly asks for token-pool, warn them about ccip_send compatibility
        logger.warn(
          `Warning: Delegation type 'token-pool' specified. ` +
          `For ccip_send compatibility, authority will be delegated to the 'fee-billing' signer PDA. ` +
          `If delegation to a pool-specific PDA is also needed, handle it separately.`
        );
        effectiveDelegationType = "fee-billing";
      } else {
        // Default case (no delegationType specified or fee-billing)
        logger.info(`Using 'fee-billing' delegation type for all tokens for ccip_send compatibility.`);
      }

      // Create delegation config for each provided token mint
      for (const tokenMint of tokenMints) {
        const customTokenConfig: TokenDelegationConfig = {
          tokenMint: tokenMint,
          tokenProgramId: cmdOptions.tokenProgramId,
          delegationType: effectiveDelegationType,
          customDelegate: customDelegateAddress,
          amount: MAX_UINT64,
        };

        tokenDelegations.push(customTokenConfig);
        logger.info(`Added custom token delegation for: ${tokenMint}`);
      }
    } else {
      // No custom tokens provided, use default configuration
      logger.info("No custom tokens provided, using default token configuration");
      tokenDelegations = [...TOKEN_DELEGATION_CONFIG.tokenDelegations];
    }

    // Process each delegation
    for (let i = 0; i < tokenDelegations.length; i++) {
      const delegation = tokenDelegations[i];
      logger.info(
        `\n[${i + 1}/${
          tokenDelegations.length
        }] Processing delegation for mint: ${delegation.tokenMint}`
      );

      await processTokenDelegation(
        delegation,
        walletKeypair,
        routerProgramId,
        connection,
        logger,
        cmdOptions
      );
    }

    logger.info("\n==== All delegations processed ====");
  } catch (error) {
    console.error("Failed to execute delegate-token-authority:", error);
    printUsage("token:delegate");
  }
}

// Check if help is requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage("token:delegate");
  process.exit(0);
}

// Run the script if it's executed directly
if (require.main === module) {
  delegateTokenAuthority().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
