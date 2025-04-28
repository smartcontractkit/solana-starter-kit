/**
 * EVM to Solana CCIP Combined Data and Token Transfer Example
 *
 * This tutorial demonstrates how to send both tokens and arbitrary data in a single message
 * from Ethereum Sepolia to Solana Devnet using Chainlink CCIP (Cross-Chain Interoperability Protocol).
 *
 * INSTRUCTIONS:
 * 1. Set up your environment variables in .env:
 *    - EVM_PRIVATE_KEY: Your Ethereum private key
 *    - EVM_RPC_URL (optional): Custom RPC URL for Ethereum Sepolia
 *
 * 2. Customize the message parameters below if needed
 *
 * 3. Run the script with: npm run evm:data-and-tokens
 *
 * You can override settings with command line arguments:
 * --fee-token       : Token to use for fees (native, wrapped-native, link, or address)
 * --receiver        : Solana receiver address
 * --amount          : Amount of tokens to send (in raw format with all decimals, e.g., "1000000000000000" for 0.001 with 18 decimals)
 * --data            : Message data to send (string or hex with 0x prefix)
 * --compute-units   : Solana compute units
 * --log-level       : Logging verbosity (0-5, where 0 is most verbose)
 *
 * Example:
 * npm run evm:data-and-tokens -- --amount 50000000000000000 --data "Custom transfer message"
 */

import { parseScriptArgs } from "../utils/message-utils";
import {
  setupClientContext,
  getTokenDetails,
  validateTokenAmounts,
} from "../utils/setup-client";
import {
  createCCIPMessageRequest,
  displayTransferSummary,
  displayTransferResults,
} from "../utils/message-utils";
import { printUsage } from "../utils/config-parser";
import { createLogger, LogLevel } from "../../../ccip-lib/evm";
import { PublicKey } from "@solana/web3.js";
import {
  FeeTokenType,
  getEVMConfig,
  ChainId,
  getCCIPSVMConfig,
} from "../../config";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// Create initial logger for startup errors
const initialLogger = createLogger("data-and-tokens", {
  level: LogLevel.INFO,
});

// Define the source chain
const sourceChain = ChainId.ETHEREUM_SEPOLIA;
const sourceChainConfig = getEVMConfig(sourceChain);

/**
 * Utility function to derive PDAs for CCIP Receiver accounts
 *
 * @param receiverProgramId - The CCIP Receiver program ID
 * @returns Object containing the derived PDAs
 */
function deriveReceiverPDAs(receiverProgramIdStr: string) {
  // Convert string to PublicKey
  const receiverProgramId = new PublicKey(receiverProgramIdStr);

  // Seeds for PDAs (these match the ones in the Rust program)
  const STATE_SEED = Buffer.from("state");
  const MESSAGES_STORAGE_SEED = Buffer.from("messages_storage");
  const TOKEN_ADMIN_SEED = Buffer.from("token_admin");

  // Derive the state PDA
  const [statePda] = PublicKey.findProgramAddressSync(
    [STATE_SEED],
    receiverProgramId
  );

  // Derive the messages storage PDA
  const [messagesStoragePda] = PublicKey.findProgramAddressSync(
    [MESSAGES_STORAGE_SEED],
    receiverProgramId
  );

  // Derive token admin PDA (authority for token accounts)
  const [tokenAdminPda] = PublicKey.findProgramAddressSync(
    [TOKEN_ADMIN_SEED],
    receiverProgramId
  );

  return {
    state: statePda,
    messagesStorage: messagesStoragePda,
    tokenAdmin: tokenAdminPda,
  };
}

/**
 * Utility function to determine the token program ID from a mint account
 *
 * @param mintPubkey - The public key of the mint account
 * @param connection - The Solana connection to use for querying
 * @param logger - The logger to use for logging
 * @returns Promise<PublicKey> - The token program ID that owns the mint
 */
async function determineTokenProgramId(
  mintPubkey: PublicKey,
  connection: any,
  logger = initialLogger
): Promise<PublicKey> {
  try {
    logger.info(
      `Getting mint account info for ${mintPubkey.toString()} to determine token program ID...`
    );
    const mintInfo = await connection.getAccountInfo(mintPubkey);

    if (!mintInfo) {
      throw new Error(`Mint account ${mintPubkey.toString()} not found`);
    }

    // The owner of the mint account is the token program (either TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID)
    const tokenProgramId = mintInfo.owner;

    // Log which token program is being used
    const usingToken2022 =
      tokenProgramId.toString() === TOKEN_2022_PROGRAM_ID.toString()
        ? "Yes"
        : "No";
    logger.info(`Token program ID: ${tokenProgramId.toString()}`);
    logger.info(`Using Token-2022 Program: ${usingToken2022}`);

    return tokenProgramId;
  } catch (error) {
    logger.warn(
      `Failed to determine token program from mint, falling back to TOKEN_2022_PROGRAM_ID: ${error}`
    );
    return TOKEN_2022_PROGRAM_ID;
  }
}

// =================================================================
// COMBINED DATA AND TOKEN TRANSFER CONFIGURATION
// Edit these values to customize your transfer
// =================================================================

// Define a function to create the message config asynchronously
const createMessageConfig = async () => {
  const solanaConfig = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);
  const recipientWalletAddress = new PublicKey(
    "EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB"
  );

  // Create an inner logger for configuration initialization
  const configLogger = createLogger("config-init", {
    level: LogLevel.INFO,
  });

  // Return the fully configured message
  return {
    // Tokens to transfer - an array of token amounts to send
    // Each token has an address and an amount
    tokenAmounts: [
      {
        // The BnM token address on the source chain
        address: sourceChainConfig.tokenAddress,

        // Token amount in raw format (with all decimals included)
        // IMPORTANT: This must be the full raw amount, not a decimal value
        // For example: "10000000000000000" = 0.01 tokens with 18 decimals
        amount: "10000000000000000",
      },
    ],

    // Custom message to send - must be properly encoded as hex with 0x prefix
    data: "0x" + Buffer.from("Hello World").toString("hex"),

    // Fee token to use for CCIP fees
    feeToken: FeeTokenType.LINK,

    // Extra configuration for Solana
    extraArgs: {
      // Compute units for Solana execution
      // Higher value needed because message processing requires compute units
      computeUnits: 200000,

      // Allow out-of-order execution
      allowOutOfOrderExecution: true,

      // Bitmap of accounts that should be made writable
      // Binary representation: 0101110 (decimal 46)
      // Analyzing the accounts in the order they appear in the `accounts` array:
      // [0] state PDA - NOT writable (0)
      // [1] messages_storage PDA - writable (1)
      // [2] token_mint - Writable (1)
      // [3] source_token_account - writable (1)  (modified during token transfer)
      // [4] token_admin - NOT writable (0)
      // [5] recipient_token_account - writable (1)
      // [6] token_program - NOT writable (0)
      //
      // Result: Binary 0101110 = Decimal 46
      // Only messages_storage and source_token_account need to be explicitly writable
      accountIsWritableBitmap: BigInt(46),

      // Token receiver is the token_admin PDA
      // CCIP will create an ATA for this PDA and deposit tokens there
      tokenReceiver: (() => {
        const receiverProgramId = solanaConfig.receiverProgramId.toString();
        const pdas = deriveReceiverPDAs(receiverProgramId);
        return pdas.tokenAdmin.toString();
      })(),

      // Accounts needed for the CCIP message
      accounts: await (async () => {
        // State and messages storage PDAs
        const receiverProgramId = solanaConfig.receiverProgramId.toString();

        const pdas = deriveReceiverPDAs(receiverProgramId);

        // Get the token mint address from config
        const mintPubkey = new PublicKey(solanaConfig.tokenMint);

        // Get the connection from solanaConfig
        const connection = solanaConfig.connection;

        // Determine the token program ID for the mint
        // This uses our utility function to get the correct program ID
        const tokenProgramId = await determineTokenProgramId(
          mintPubkey,
          connection,
          configLogger
        );

        // Derive the Associated Token Account for the recipient
        // This is the account where tokens will be sent
        const recipientATA = getAssociatedTokenAddressSync(
          mintPubkey,
          recipientWalletAddress,
          false, // allowOwnerOffCurve = false for regular wallet addresses
          tokenProgramId // Use the correct token program ID
        );

        configLogger.info(
          `Derived recipient ATA ${recipientATA.toString()} for wallet ${recipientWalletAddress.toString()}`
        );

        // Derive the Associated Token Account for the token_admin PDA
        // This is where tokens will be initially deposited by CCIP
        const tokenAdminATA = getAssociatedTokenAddressSync(
          mintPubkey,
          pdas.tokenAdmin,
          true, // allowOwnerOffCurve = true since PDAs are off-curve
          tokenProgramId
        );

        // Return all required accounts in order:
        // First the state and messages storage for message processing
        // Then the 5 token accounts needed for token transfers
        return [
          // [0] state PDA - Required by the CcipReceive context
          pdas.state.toString(),

          // [1] messages_storage PDA - Required by the CcipReceive context and must be writable
          pdas.messagesStorage.toString(),

          // [2] token_mint - The token mint account
          solanaConfig.tokenMint.toString(),

          // [3] source_token_account - The token account where CCIP initially deposits tokens
          tokenAdminATA.toString(),

          // [4] token_admin - The token admin PDA that has authority
          pdas.tokenAdmin.toString(),

          // [5] recipient_token_account - Where tokens will be transferred to
          recipientATA.toString(),

          // [6] token_program - Determined dynamically using determineTokenProgramId
          tokenProgramId.toString(),
        ];
      })(),
    },

    // Receiver program ID - set to the CCIP Receiver Program
    receiver: solanaConfig.receiverProgramId.toString(),
  };
};

// Initialize as a Promise and resolve it in the main function
let MESSAGE_CONFIG_PROMISE = createMessageConfig();

// =================================================================

/**
 * Main function for combined data and token transfer
 */
async function dataAndTokenTransfer(): Promise<void> {
  let logger = initialLogger;

  try {
    // STEP 1: Wait for the message config to be fully initialized
    const MESSAGE_CONFIG = await MESSAGE_CONFIG_PROMISE;

    // Get configuration from both hardcoded values and optional command line args
    const cmdOptions = parseScriptArgs();

    // Convert tokenAmounts to the format expected by the SDK
    const configTokenAmounts = MESSAGE_CONFIG.tokenAmounts.map((ta) => ({
      token: ta.address,
      amount: ta.amount,
    }));

    // Combine hardcoded config with any command line overrides
    const options = {
      // Start with hardcoded values
      tokenAmounts:
        cmdOptions.tokenAmounts && cmdOptions.tokenAmounts.length > 0
          ? cmdOptions.tokenAmounts
          : configTokenAmounts,
      data: MESSAGE_CONFIG.data,
      receiver: MESSAGE_CONFIG.receiver,
      feeToken: MESSAGE_CONFIG.feeToken,
      computeUnits: MESSAGE_CONFIG.extraArgs.computeUnits,
      allowOutOfOrderExecution:
        MESSAGE_CONFIG.extraArgs.allowOutOfOrderExecution,
      accountIsWritableBitmap: MESSAGE_CONFIG.extraArgs.accountIsWritableBitmap,
      tokenReceiver: MESSAGE_CONFIG.extraArgs.tokenReceiver,
      accounts: MESSAGE_CONFIG.extraArgs.accounts,

      // Pass chainId directly from the source chain variable
      chainId: sourceChain,

      // Command line arguments override hardcoded config
      ...cmdOptions,
    };

    // Ensure we have message data
    if (!options.data || options.data === "0x") {
      options.data = MESSAGE_CONFIG.data;
      logger.info(`No message data provided, using default message data`);
    }

    // Ensure we have tokenAmounts
    if (!options.tokenAmounts || options.tokenAmounts.length === 0) {
      throw new Error(
        "No token amounts provided. Please specify at least one token amount to transfer."
      );
    }

    // STEP 2: Set up client context (logger, provider, config)
    const context = await setupClientContext(options, "data-and-tokens");

    // Use the properly configured logger from context
    logger = context.logger;

    const { client, config, signerAddress } = context;

    // STEP 3: Get token details and validate balances
    const tokenDetails = await getTokenDetails(context, options.tokenAmounts);
    validateTokenAmounts(context, tokenDetails);

    // Token program ID is already correctly set in the accounts array
    // No need to update it here as we already used determineTokenProgramId during initialization

    // STEP 4: Create the CCIP message request
    const messageRequest = createCCIPMessageRequest(config, options, logger);

    // STEP 5: Display transfer summary
    // Use the first token for display purposes in the legacy summary function
    const primaryToken = tokenDetails[0];
    displayTransferSummary(
      config,
      options,
      messageRequest,
      {
        symbol: primaryToken.tokenSymbol,
        decimals: primaryToken.tokenDecimals,
      },
      logger,
      signerAddress
    );

    // STEP 6: Send the CCIP message
    logger.info("\nSending CCIP message with tokens and data...");

    try {
      // Execute transfer using sendCCIPMessage - the SDK handles token approvals automatically
      const result = await client.sendCCIPMessage(messageRequest);

      // STEP 7: Display transfer results
      displayTransferResults(result, config, logger);
    } catch (error) {
      logger.error("Failed to send CCIP message", error);
      throw error;
    }
  } catch (error) {
    logger.error("\n❌ Error executing combined data and token transfer:");
    if (error instanceof Error) {
      logger.error(error.message);
      if (error.stack) {
        logger.error(error.stack);
      }
    } else {
      logger.error(String(error));
    }

    printUsage("evm:data-and-tokens");
    process.exit(1);
  }
}

// Run the script
dataAndTokenTransfer().catch((error) => {
  initialLogger.error("Unhandled error in data and token transfer:", error);
  process.exit(1);
});
