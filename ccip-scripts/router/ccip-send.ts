import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
} from "@solana/spl-token";

// Import from SDK for types and utilities
import {
  CCIPSendRequest,
  CCIPSendOptions,
  ExtraArgsOptions,
  LogLevel,
  AddressConversion,
} from "../../ccip-sdk";

// Import our local utilities
import { getCCIPConfig } from "../config";
import { loadKeypair, parseCCIPSendArgs, printUsage, getKeypairPath } from "../utils";
import { createCCIPClient } from "../utils/client-factory";

// Define fee token types for better usability
enum FeeTokenType {
  NATIVE = 'native',
  WRAPPED_NATIVE = 'wrapped-native',
  LINK = 'link'
}

/**
 * Sends a CCIP message from Solana to Ethereum Sepolia
 */
async function sendCcipMessage() {
  try {
    // Parse command line arguments
    const options = parseCCIPSendArgs();
    const network = options.network || "devnet";
    
    // Use the appropriate keypair path
    console.log("\n==== Environment Information ====");
    console.log(`Solana Cluster: ${network}`);
    
    const keypairPath = getKeypairPath(options);
    console.log("Keypair Path:", keypairPath);
    console.log("Log Level:", LogLevel[options.logLevel ?? LogLevel.INFO]);
    console.log("Skip Preflight:", options.skipPreflight ? "Yes" : "No");

    // Load wallet keypair
    const walletKeypair = loadKeypair(keypairPath);
    console.log("Wallet public key:", walletKeypair.publicKey.toString());

    // Get the configuration
    const config = getCCIPConfig(network);

    // Create the CCIPClient with our factory
    const ccipClient = createCCIPClient({
      network,
      keypairPath,
      logLevel: options.logLevel,
      skipPreflight: options.skipPreflight,
    });

    // Check wallet balance
    console.log("\n==== Wallet Balance Information ====");
    const connection = config.connection;
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log("SOL Balance:", balance / LAMPORTS_PER_SOL, "SOL");
    console.log("Lamports Balance:", balance, "lamports");

    console.log("\n==== CCIP Router Information ====");
    console.log(
      "CCIP Router Program ID:",
      config.ccipRouterProgramId.toString()
    );
    console.log("Fee Quoter Program ID:", config.feeQuoterProgramId.toString());
    console.log("RMN Remote Program ID:", config.rmnRemoteProgramId.toString());

    // Check token balances for all tokens used in the transaction
    console.log("\n==== Token Balance Check ====");

    // Get token details
    const TOKEN_MINT = config.tokenMint;
    const TOKEN_DECIMALS = 9;

    // Define the amount of tokens to transfer
    const TOKEN_AMOUNT = 0.01; // 0.01 tokens

    // Get the token account address
    const userTokenAccount = getAssociatedTokenAddressSync(
      TOKEN_MINT,
      walletKeypair.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    // Initialize token balance
    let tokenBalance = 0;

    console.log("\n==== Token Account Diagnostics ====");
    console.log("User Token Account Address:", userTokenAccount.toString());

    // Check if the account exists at the address
    const accountInfo = await connection.getAccountInfo(userTokenAccount);
    if (accountInfo) {
      console.log("Token account exists with the following details:");
      console.log("- Data size:", accountInfo.data.length, "bytes");
      console.log("- Owner program:", accountInfo.owner.toString());
      console.log("- Executable:", accountInfo.executable);
      console.log("- Lamports:", accountInfo.lamports);

      try {
        // Get token account data
        const tokenAccount = await getAccount(
          connection,
          userTokenAccount,
          undefined,
          TOKEN_2022_PROGRAM_ID
        );
        const tokenAmount =
          Number(tokenAccount.amount) / Math.pow(10, TOKEN_DECIMALS);
        console.log("- Token Balance:", tokenAmount, "tokens");
        console.log("- Is Initialized:", tokenAccount.isInitialized);
        console.log("- Is Native:", tokenAccount.isNative);
        tokenBalance = tokenAmount;
      } catch (error) {
        console.error(
          "Error parsing token account:",
          error instanceof Error ? error.message : String(error)
        );
      }
    } else {
      console.log("Token account does not exist.");
      console.log("\n⚠️ Required Actions for Testing ⚠️");
      console.log("To test token transfers, you need to:");
      console.log(
        `1. Create an associated token account for ${TOKEN_MINT.toString()}`
      );
      console.log(
        `2. Fund the token account with at least ${TOKEN_AMOUNT} tokens`
      );
      console.log(
        "\nYou can use the following command to create the token account:"
      );
      console.log(
        `spl-token create-account ${TOKEN_MINT.toString()} --owner ${walletKeypair.publicKey.toString()}`
      );
      console.log(
        "\nTo fund the account, request tokens from a faucet or transfer from another account:"
      );
      console.log(
        `spl-token transfer ${TOKEN_MINT.toString()} ${TOKEN_AMOUNT} ${walletKeypair.publicKey.toString()} --fund-recipient`
      );
    }

    // Prepare the message details
    const EVM_RECEIVER = "0x9d087fC03ae39b088326b67fA3C788236645b717";
    const DEST_CHAIN_SELECTOR = config.ethereumSepoliaSelector;
    
    // Set fee token based on command line argument or use default
    let FEE_TOKEN;
    if (options.feeToken) {
      const tokenOption = options.feeToken.toLowerCase();
      
      // Use the appropriate config value based on the token type
      switch (tokenOption) {
        case FeeTokenType.NATIVE:
          FEE_TOKEN = config.nativeSol;
          console.log('Using native SOL as fee token');
          break;
        
        case FeeTokenType.WRAPPED_NATIVE:
          FEE_TOKEN = NATIVE_MINT;
          console.log('Using wrapped SOL as fee token:', NATIVE_MINT.toString());
          break;
        
        case FeeTokenType.LINK:
          if (config.linkTokenMint) {
            FEE_TOKEN = config.linkTokenMint;
            console.log('Using LINK token as fee token:', config.linkTokenMint.toString());
          } else {
            console.warn('LINK token mint not defined in config, falling back to native SOL');
            FEE_TOKEN = config.nativeSol;
          }
          break;
        
        default:
          // Try to parse it as a custom address
          try {
            FEE_TOKEN = new PublicKey(options.feeToken);
            console.log(`Using custom fee token address: ${FEE_TOKEN.toString()}`);
          } catch (error) {
            console.warn(`Invalid fee token: ${options.feeToken}, using default native SOL`);
            FEE_TOKEN = config.nativeSol;
          }
      }
    } else {
      // Default to native SOL from config
      FEE_TOKEN = config.nativeSol;
      console.log('Using default fee token: native SOL');
    }

    // Display settings
    console.log("\n==== CCIP Send Configuration ====");
    console.log("Destination Chain Selector:", DEST_CHAIN_SELECTOR.toString());
    console.log("Receiver Address:", EVM_RECEIVER);
    console.log("Token Mint:", TOKEN_MINT.toString());
    console.log("Token Amount:", TOKEN_AMOUNT, "tokens");
    console.log("Fee Token:", FEE_TOKEN.toString(), "(Native SOL)");

    // Create extraArgs configuration once and reuse it
    const extraArgsConfig: ExtraArgsOptions = {
      gasLimit: 0,
      allowOutOfOrderExecution: true,
    };

    // Generate the extraArgs buffer
    const extraArgs = ccipClient.createExtraArgs(extraArgsConfig);

    // Convert the EVM address to the format expected by Solana using SDK's AddressConversion
    const receiverBytes =
      AddressConversion.evmAddressToSolanaBytes(EVM_RECEIVER);

    // Convert amount to on-chain representation with proper decimals
    const onChainAmount = new anchor.BN(
      TOKEN_AMOUNT * Math.pow(10, TOKEN_DECIMALS)
    );

    // Create the CCIP Send Request
    const sendRequest: CCIPSendRequest = {
      destChainSelector: new anchor.BN(DEST_CHAIN_SELECTOR.toString()),
      receiver: receiverBytes,
      data: Buffer.alloc(0), // Empty data for token transfer only
      tokenAmounts: [
        {
          token: TOKEN_MINT,
          amount: onChainAmount,
        },
      ],
      feeToken: FEE_TOKEN,
      extraArgs: extraArgs,
    };

    // Log the exact fee token value for debugging
    console.log("\n==== FEE TOKEN DEBUG ====");
    console.log("Request feeToken:", sendRequest.feeToken.toString());
    console.log(
      "Is PublicKey.default?",
      sendRequest.feeToken.equals(PublicKey.default)
    );
    console.log("NATIVE_MINT value:", NATIVE_MINT.toString());
    console.log("Public.default value:", PublicKey.default.toString());

    console.log("Preparing to send CCIP message...");

    // Add compute budget instruction to increase compute units
    const additionalComputeBudget = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_400_000, // Maximum compute units
    });

    console.log(
      "Added compute budget instruction to increase compute limit to 1,400,000 units"
    );

    // First get the fee to show the user what they'll pay
    const feeRequest = {
      destChainSelector: sendRequest.destChainSelector,
      message: {
        receiver: sendRequest.receiver,
        data: sendRequest.data,
        tokenAmounts: sendRequest.tokenAmounts.map(({ token, amount }) => ({
          token,
          amount,
        })),
        feeToken: sendRequest.feeToken,
        extraArgs: extraArgs, // Reuse the same extraArgs buffer
      },
    };

    console.log("Calculating fee for this transaction...");
    const feeResult = await ccipClient.getFee(feeRequest);

    // Format fee amount based on token type
    let formattedFee: string;
    const feeTokenResult = new PublicKey(feeResult.token);

    if (feeTokenResult.equals(NATIVE_MINT)) {
      formattedFee = `${feeResult.amount.toNumber() / LAMPORTS_PER_SOL} SOL`;
    } else {
      formattedFee = `${feeResult.amount.toString()} (Token: ${feeTokenResult.toString()})`;
    }

    console.log(`\nEstimated fee: ${formattedFee}`);
    console.log(`Fee in Juels: ${feeResult.juels.toString()}`);

    // Validate balance before proceeding
    console.log("\n==== Balance Validation ====");

    // Validate SOL balance (for transaction fee + gas if using native SOL for fees)
    const minSolRequired = 0.005; // Minimum SOL needed for transaction (adjust as needed)
    const solBalance =
      (await connection.getBalance(walletKeypair.publicKey)) / LAMPORTS_PER_SOL;
    console.log(`SOL Balance: ${solBalance} SOL`);

    if (solBalance < minSolRequired) {
      console.error(
        `⚠️ Not enough SOL for transaction. Have ${solBalance}, need at least ${minSolRequired} SOL`
      );
      throw new Error("Insufficient SOL balance for transaction fees");
    }

    // Validate token balance
    if (tokenBalance < TOKEN_AMOUNT) {
      console.error(
        `⚠️ Not enough tokens for transfer. Have ${tokenBalance}, need ${TOKEN_AMOUNT} tokens`
      );
      throw new Error("Insufficient token balance for transfer");
    }

    console.log("✅ Balance validation passed. Proceeding with transaction.");

    // Execute the CCIP send
    console.log("\n==== Sending CCIP Message ====");
    console.log("⏳ This may take a minute...");

    // Create send options if skipPreflight is enabled
    const sendOptions: CCIPSendOptions | undefined = options.skipPreflight
      ? { skipPreflight: true }
      : undefined;

    // Use the client to send the message
    const result = await ccipClient.sendWithMessageId(
      sendRequest,
      additionalComputeBudget,
      sendOptions
    );

    console.log("\n==== CCIP Message Sent ====");
    console.log("Transaction signature:", result.txSignature);

    if (result.messageId) {
      console.log("Message ID:", result.messageId);
      console.log(
        `Open the CCIP explorer: https://ccip-ui-staging.vercel.app/msg/${result.messageId}`
      );
    } else {
      console.log("Message ID not available in transaction logs.");
    }

    console.log("\nView transaction on explorer:");
    console.log(
      `https://explorer.solana.com/tx/${result.txSignature}?cluster=${network}`
    );
  } catch (error) {
    console.error(
      "\n❌ Failed to send CCIP message:",
      error instanceof Error ? error.message : String(error)
    );

    if (error instanceof Error && error.stack) {
      console.log("\nError stack:");
      console.log(error.stack);

      // Check for context in enhanced errors from SDK
      if ((error as any).context) {
        console.error("\nError Context:");
        console.error(JSON.stringify((error as any).context, null, 2));
      }
    }
    printUsage("ccip:send");
    process.exit(1);
  }
}

// Check if help is requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage("ccip:send");
  process.exit(0);
}

// Run the script
sendCcipMessage().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
