import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAccount,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
} from "@solana/spl-token";
import {
  loadKeypair,
  parseCommonArgs,
  printUsage,
  getKeypairPath,
  determineTokenProgramId,
} from "../utils";
import {
  findFeeBillingSignerPDA,
  findExternalTokenPoolsSignerPDA,
  findDynamicTokenPoolsSignerPDA,
} from "../../../ccip-lib/svm/utils/pdas";
import { ChainId, getCCIPSVMConfig } from "../../config";
import { LogLevel, createLogger } from "../../../ccip-lib/svm";

// Get configuration - we only support Solana Devnet for now
const config = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);

// =================================================================
// TOKEN APPROVAL CONFIGURATION
// Core parameters for token approval checks
// =================================================================

/**
 * Delegation type determines which PDA will be expected for delegation
 */
type DelegationType = "fee-billing" | "token-pool" | "custom";

/**
 * Token approval configuration interface
 */
interface TokenApprovalConfig {
  tokenMint: PublicKey | string;
  description: string;
  delegationType: DelegationType;
}

/**
 * Extended options for token approval operations
 */
interface TokenApprovalOptions extends ReturnType<typeof parseCommonArgs> {
  delegationType?: DelegationType;
  customDelegate?: string | PublicKey;
}

/**
 * Status information for a token account's approvals
 */
interface TokenApprovalStatus {
  mint: PublicKey;
  tokenAccount: PublicKey;
  description: string;
  balance: string;
  delegate: PublicKey | null;
  delegatedAmount: string;
  hasDelegate: boolean;
  expectedDelegate: PublicKey | null;
  matchesExpectedDelegate: boolean;
}

const TOKEN_APPROVAL_CONFIG = {
  // Tokens to check
  tokensToCheck: [
    {
      // Wrapped SOL (wSOL)
      tokenMint: NATIVE_MINT,
      description: "Wrapped SOL (wSOL)",
      delegationType: "fee-billing" as DelegationType,
    },
    {
      // BnM token - using config value directly
      tokenMint: config.tokenMint,
      description: "BnM Token",
      delegationType: "token-pool" as DelegationType,
    },
    {
      // LINK token - using config value directly
      tokenMint: config.linkTokenMint,
      description: "LINK Token",
      delegationType: "fee-billing" as DelegationType,
    },
  ],
};

// =================================================================
// SCRIPT CONFIGURATION
// Parameters specific to this script
// =================================================================
const SCRIPT_CONFIG = {
  computeUnits: 400_000, // Compute units for token approval checks
  minSolRequired: 0.001, // Minimum SOL needed for transaction fees
};
// =================================================================

/**
 * Parse command line arguments for token approval operations
 */
function parseTokenApprovalArgs(): TokenApprovalOptions {
  const commonOptions = parseCommonArgs();
  const args = process.argv.slice(2);
  const options: TokenApprovalOptions = {
    ...commonOptions,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--delegation-type" && i + 1 < args.length) {
      const delegationType = args[i + 1].toLowerCase();
      if (
        delegationType === "fee-billing" ||
        delegationType === "token-pool" ||
        delegationType === "custom"
      ) {
        options.delegationType = delegationType as DelegationType;
      } else {
        console.warn(
          `Unknown delegation type: ${delegationType}, using fee-billing`
        );
        options.delegationType = "fee-billing";
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
 * Resolve a delegate address based on delegation type and token mint
 *
 * @param delegationType Type of delegation (fee-billing, token-pool, custom)
 * @param routerProgramId Router program ID
 * @param tokenMint Token mint address
 * @param customDelegate Custom delegate address (optional)
 * @param connection Solana connection
 * @returns Resolved delegate public key
 */
async function resolveDelegateAddress(
  delegationType: DelegationType,
  routerProgramId: PublicKey,
  tokenMint: PublicKey,
  customDelegate?: PublicKey | string,
  connection?: any
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
 * Check token approvals for a list of token mints
 *
 * @param mints List of token mints to check with their configuration
 * @param options Command line options
 * @param logger Structured logger instance
 * @returns List of token approval statuses
 */
async function checkTokenApprovals(
  mints: TokenApprovalConfig[],
  options: TokenApprovalOptions,
  logger: any,
  connection: any,
  walletPublicKey: PublicKey,
  routerProgramId: PublicKey
): Promise<TokenApprovalStatus[]> {
  const results: TokenApprovalStatus[] = [];

  // Process each mint
  for (let i = 0; i < mints.length; i++) {
    const tokenConfig = mints[i];

    try {
      // Convert tokenMint to PublicKey
      if (!tokenConfig.tokenMint) {
        logger.warn(`Skipping token with null mint in position ${i}`);
        continue;
      }

      const tokenMint =
        tokenConfig.tokenMint instanceof PublicKey
          ? tokenConfig.tokenMint
          : new PublicKey(tokenConfig.tokenMint.toString());

      logger.info(
        `\n[${i + 1}/${mints.length}] Processing token: ${
          tokenConfig.description
        }`
      );
      logger.info(`Mint: ${tokenMint.toString()}`);

      // Determine token program dynamically
      const tokenProgramId = await determineTokenProgramId(
        tokenMint,
        connection,
        logger
      );

      logger.info(`Token Program ID: ${tokenProgramId.toString()}`);

      // Get the Associated Token Account (ATA) for this wallet and mint
      const tokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        walletPublicKey,
        false,
        tokenProgramId
      );

      logger.info(`Token Account: ${tokenAccount.toString()}`);

      // Resolve the expected delegate based on delegation type
      const expectedDelegate = await resolveDelegateAddress(
        tokenConfig.delegationType,
        routerProgramId,
        tokenMint,
        options.customDelegate,
        connection
      );

      logger.info(
        `Expected Delegate (${
          tokenConfig.delegationType
        }): ${expectedDelegate.toString()}`
      );

      try {
        // Fetch the token account data using the specific token program
        const tokenAccountInfo = await getAccount(
          connection,
          tokenAccount,
          connection.commitment,
          tokenProgramId
        );

        // Extract relevant information
        const delegateAddress = tokenAccountInfo.delegate;
        const delegatedAmount = tokenAccountInfo.delegatedAmount;
        const balance = tokenAccountInfo.amount;

        // Check if the delegate matches the expected one
        const matchesExpectedDelegate =
          delegateAddress !== null &&
          expectedDelegate !== null &&
          delegateAddress.equals(expectedDelegate);

        // Log info
        logger.info(`Balance: ${balance.toString()}`);

        if (delegateAddress !== null) {
          logger.info(`Actual Delegate: ${delegateAddress.toString()}`);
          logger.info(`Delegated Amount: ${delegatedAmount.toString()}`);
          logger.info(
            `Matches Expected Delegate: ${
              matchesExpectedDelegate ? "✓ Yes" : "✗ No"
            }`
          );
        } else {
          logger.info("No delegate set for this token account");
        }

        // Store result
        results.push({
          mint: tokenMint,
          tokenAccount,
          description: tokenConfig.description,
          balance: balance.toString(),
          delegate: delegateAddress,
          delegatedAmount: delegatedAmount.toString(),
          hasDelegate: delegateAddress !== null,
          expectedDelegate,
          matchesExpectedDelegate:
            delegateAddress !== null ? matchesExpectedDelegate : false,
        });
      } catch (error) {
        logger.warn(`Error fetching token account: Account may not exist`);

        if (error instanceof Error) {
          logger.debug(`Error details: ${error.message}`);
        }

        // Store result for non-existent accounts
        results.push({
          mint: tokenMint,
          tokenAccount,
          description: tokenConfig.description,
          balance: "0",
          delegate: null,
          delegatedAmount: "0",
          hasDelegate: false,
          expectedDelegate,
          matchesExpectedDelegate: false,
        });
      }
    } catch (error) {
      logger.error(
        `❌ Error processing token ${tokenConfig.description}:`,
        error instanceof Error ? error.message : String(error)
      );

      if (error instanceof Error && error.stack) {
        logger.debug("Error stack:");
        logger.debug(error.stack);
      }
    }
  }

  return results;
}

/**
 * Main entry point for the token approval checker
 */
async function checkTokenApprovalEntrypoint(): Promise<void> {
  try {
    // Parse command line arguments
    const cmdOptions = parseTokenApprovalArgs();

    // Create logger with appropriate level
    const logger = createLogger("token-approval", {
      level: cmdOptions.logLevel ?? LogLevel.INFO,
    });

    // Display environment information
    logger.info("\n==== Environment Information ====");
    logger.info(`Solana Cluster: ${cmdOptions.network || "devnet"}`);

    // Get appropriate keypair path
    const keypairPath = getKeypairPath(cmdOptions);
    logger.info(`Keypair Path: ${keypairPath}`);

    // Load wallet keypair
    const walletKeypair = loadKeypair(keypairPath);
    logger.info(`Wallet public key: ${walletKeypair.publicKey.toString()}`);

    // Config is already defined at the top of the file
    const routerProgramId = config.routerProgramId;
    logger.info(`Router Program ID: ${routerProgramId.toString()}`);

    // Check wallet SOL balance
    logger.info("\n==== Wallet Balance Information ====");
    const connection = config.connection;
    const balance = await connection.getBalance(walletKeypair.publicKey);
    logger.info(`SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    logger.info(`Lamports Balance: ${balance} lamports`);

    // Process token approvals - tokensToCheck is already fully defined
    logger.info("\n==== Processing Token Approvals ====");
    const results = await checkTokenApprovals(
      TOKEN_APPROVAL_CONFIG.tokensToCheck,
      cmdOptions,
      logger,
      connection,
      walletKeypair.publicKey,
      routerProgramId
    );

    // Display results in tabular format
    logger.info("\n==== Token Approval Summary ====");
    logger.info(
      "Token | Description | Balance | Delegate | Delegated Amount | Status"
    );
    logger.info(
      "------|-------------|---------|----------|-----------------|-------"
    );

    for (const result of results) {
      logger.info(
        `${result.mint.toString().slice(0, 8)}... | ` +
          `${result.description} | ` +
          `${result.balance} | ` +
          `${
            result.delegate
              ? result.delegate.toString().slice(0, 8) + "..."
              : "None"
          } | ` +
          `${result.delegatedAmount} | ` +
          `${
            result.hasDelegate
              ? result.matchesExpectedDelegate
                ? "✓ Correct"
                : "✗ Wrong"
              : "No Delegate"
          }`
      );
    }

    logger.info("\nToken approval check completed successfully");
  } catch (error) {
    console.error("Failed to check token approvals:", error);
    printUsage("token:check");
  }
}

// Check if help is requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage("token:check");
  process.exit(0);
}

// Run the script if it's executed directly
if (require.main === module) {
  checkTokenApprovalEntrypoint().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}
