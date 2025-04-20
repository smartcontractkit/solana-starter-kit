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
import { ethers } from "ethers";
import { PublicKey } from "@solana/web3.js";
import { FeeTokenType, getEVMConfig, ChainId, getCCIPSVMConfig } from "../../config";

// Create initial logger for startup errors
const initialLogger = createLogger("data-and-tokens", {
  level: LogLevel.INFO,
});

// Get network configuration to access tokenAddress
const config = getEVMConfig(ChainId.ETHEREUM_SEPOLIA);

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
  const TOKEN_VAULT_SEED = Buffer.from("token_vault");
  
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
  
  // Derive token vault authority PDA
  const [tokenVaultAuthority] = PublicKey.findProgramAddressSync(
    [TOKEN_VAULT_SEED],
    receiverProgramId
  );
  
  return {
    state: statePda,
    messagesStorage: messagesStoragePda,
    tokenVaultAuthority
  };
}

/**
 * Get the token accounts required for CCIP token transfer
 * 
 * For token transfers, the ccip_receive handler requires 5 additional accounts:
 * 1. token_mint: Account<Mint> - The token mint account
 * 2. token_vault: Account<TokenAccount> - The token vault account where CCIP first deposits tokens
 * 3. token_vault_authority: UncheckedAccount - The authority PDA for the token vault
 * 4. recipient_token_account: Account<TokenAccount> - The recipient's token account
 * 5. token_program: Program<Token> - The token program (SPL Token or Token-2022)
 */
function getTokenAccounts() {
  // Get the Solana configuration
  const solanaConfig = getCCIPSVMConfig(ChainId.SOLANA_DEVNET);
  const receiverProgramId = solanaConfig.receiverProgramId.toString();
  const pdas = deriveReceiverPDAs(receiverProgramId);
  
  // Need to get the correct token addresses from somewhere appropriate
  // These would typically come from environment variables or configuration
  // For this tutorial, we'll use placeholders that must be replaced
  
  // These must match the accounts expected by the ccip_receive handler
  return {
    // 1. Token mint - the Solana token mint address (equivalent to the EVM token)
    // This should be the wrapped version of the EVM token on Solana
    tokenMint: "TOKEN_MINT_ADDRESS", // Replace with actual token mint on Solana
    
    // 2. Token vault - this is where CCIP router deposits the tokens first
    // This is a token account owned by the CCIP Receiver program
    tokenVault: "TOKEN_VAULT_ADDRESS", // Replace with actual token vault
    
    // 3. Token vault authority - PDA that has authority over the vault
    tokenVaultAuthority: pdas.tokenVaultAuthority.toString(),
    
    // 4. Recipient token account - the account where tokens will be sent
    // This should be the recipient's token account that can hold the specific token
    recipientTokenAccount: "HWFMEkEaiYXYngJvmYT1AU4aaxR85mowvD88j4cLNpxp", // ATA of the recipient
    
    // 5. Token program - usually SPL Token program
    tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" // SPL Token program
  };
}

// =================================================================
// COMBINED DATA AND TOKEN TRANSFER CONFIGURATION
// Edit these values to customize your transfer
// =================================================================

const MESSAGE_CONFIG = {
  // Tokens to transfer - an array of token amounts to send
  // Each token has an address and an amount
  tokenAmounts: [
    {
      // The BnM token address on Ethereum Sepolia
      address: config.tokenAddress,

      // Token amount in raw format (with all decimals included)
      // IMPORTANT: This must be the full raw amount, not a decimal value
      // For example: "10000000000000000" = 0.01 tokens with 18 decimals
      amount: "10000000000000000",
    },
  ],

  // Custom message to send - must be properly encoded as hex with 0x prefix
  // This example encodes "Transfer with message" to hex
  data: "0x" + Buffer.from("Transfer with message").toString("hex"),

  // Fee token to use for CCIP fees
  feeToken: FeeTokenType.LINK,

  // Extra configuration for Solana
  extraArgs: {
    // Compute units for Solana execution
    // Higher value needed because message processing requires compute units
    computeUnits: 200000,

    // Allow out-of-order execution
    allowOutOfOrderExecution: true,

    // Bitmap of accounts that should be made writeable
    // Setting 3 (binary 11) to make both state and messages_storage writable
    accountIsWritableBitmap: BigInt(3),

    // Token receiver wallet address (where tokens will ultimately arrive)
    // This should match the token account owner of recipientTokenAccount
    tokenReceiver: "RECIPIENT_WALLET_ADDRESS", // Replace with the actual wallet address

    // Accounts needed for the CCIP message
    accounts: (() => {
      // State and messages storage PDAs
      const receiverProgramId = getCCIPSVMConfig(
        ChainId.SOLANA_DEVNET
      ).receiverProgramId.toString();
      
      const pdas = deriveReceiverPDAs(receiverProgramId);
      
      // Get token accounts needed for transfers
      const tokenAccounts = getTokenAccounts();
      
      // Return all required accounts in order:
      // First the state and messages storage for message processing
      // Then the 5 token accounts needed for token transfers
      return [
        // Accounts for message storage
        pdas.state.toString(),
        pdas.messagesStorage.toString(),
        
        // The 5 token accounts required by the ccip_receive handler:
        tokenAccounts.tokenMint,
        tokenAccounts.tokenVault,
        tokenAccounts.tokenVaultAuthority, 
        tokenAccounts.recipientTokenAccount,
        tokenAccounts.tokenProgram
      ];
    })(),
  },

  // Receiver program ID - set to the CCIP Receiver Program
  receiver: getCCIPSVMConfig(
    ChainId.SOLANA_DEVNET
  ).receiverProgramId.toString(),
};
// =================================================================

/**
 * Main function for combined data and token transfer
 */
async function dataAndTokenTransfer(): Promise<void> {
  let logger = initialLogger;

  try {
    // STEP 1: Get configuration from both hardcoded values and optional command line args
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
    const validatedAmounts = validateTokenAmounts(context, tokenDetails);

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
