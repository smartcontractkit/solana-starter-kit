/**
 * Token Authority Delegation Script (CLI Framework Version)
 *
 * This script delegates token authority to the appropriate signer PDA for CCIP operations.
 * All tokens used in ccip_send transactions MUST be delegated to the fee-billing signer PDA.
 */

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
import { detectTokenProgram } from "../../../ccip-lib/svm";
import {
  findFeeBillingSignerPDA,
  findExternalTokenPoolsSignerPDA,
  findDynamicTokenPoolsSignerPDA,
} from "../../../ccip-lib/svm/utils/pdas";
import { ChainId, getCCIPSVMConfig, resolveNetworkConfig } from "../../config";
import { loadKeypair, getKeypairPath } from "../utils";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

// Maximum uint64 value for unlimited approvals
const MAX_UINT64 = ((BigInt(1) << BigInt(64)) - BigInt(1)).toString();

/**
 * Delegation type determines which PDA will be used for delegation
 */
type DelegationType = "fee-billing" | "token-pool" | "custom";

/**
 * Token delegation configuration interface
 */
interface TokenDelegationConfig {
  tokenMint: PublicKey | string;
  tokenProgramId?: PublicKey | string;
  delegationType: DelegationType;
  customDelegate?: PublicKey | string;
  amount: string;
}

/**
 * Options specific to the delegate-token-authority command
 */
interface DelegateTokenAuthorityOptions extends BaseCommandOptions {
  tokenMint?: string;
  tokenProgramId?: string;
  delegationType?: DelegationType;
  customDelegate?: string;
}

/**
 * Script configuration parameters
 */
const SCRIPT_CONFIG = {
  computeUnits: 1_400_000,
  minSolRequired: 0.001,
  retries: 5,
};

/**
 * Token Authority Delegation Command
 */
class DelegateTokenAuthorityCommand extends CCIPCommand<DelegateTokenAuthorityOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "delegate-token-authority",
      description: "🔐 CCIP Token Authority Delegator\n\nDelegates token authority to the appropriate signer PDA for CCIP operations. All tokens used in ccip_send transactions MUST be delegated to the fee-billing signer PDA.",
      examples: [
        "# Delegate default tokens (wSOL, BnM, LINK) to fee-billing PDA",
        "yarn svm:token:delegate-token-authority",
        "",
        "# Delegate specific token to fee-billing PDA",
        "yarn svm:token:delegate-token-authority --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        "",
        "# Delegate multiple tokens (comma-separated)",
        "yarn svm:token:delegate-token-authority --token-mint \"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU,So11111111111111111111111111111111111111112\"",
        "",
        "# Delegate with specific token program ID",
        "yarn svm:token:delegate-token-authority --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --token-program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
        "",
        "# Delegate to custom address",
        "yarn svm:token:delegate-token-authority --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --delegation-type custom --custom-delegate 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T"
      ],
      notes: [
        "All tokens for ccip_send MUST be delegated to 'fee-billing' signer PDA",
        "Creates Associated Token Account (ATA) if it doesn't exist",
        "Uses unlimited approval (max uint64) for maximum flexibility",
        "Multiple token mints can be delegated using comma-separated values",
        "Token program ID is auto-detected if not specified",
        "Router program ID is automatically loaded from CCIP configuration"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "token-mint",
        required: false,
        type: "string",
        description: "Token mint address(es) to delegate (comma-separated for multiple). If not provided, delegates default tokens (wSOL, BnM, LINK)",
        example: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
      },
      {
        name: "token-program-id",
        required: false,
        type: "string",
        description: "Token program ID (auto-detected if not specified)",
        example: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
      },
      {
        name: "delegation-type",
        required: false,
        type: "string",
        description: "Delegation type: fee-billing (default), token-pool, or custom",
        example: "fee-billing"
      },
      {
        name: "custom-delegate",
        required: false,
        type: "string",
        description: "Custom delegate address (required when delegation-type is 'custom')",
        example: "8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T"
      }
    ];
  }

  /**
   * Create token delegation configuration for commonly used tokens
   */
  private createTokenDelegationConfig(config: any): { tokenDelegations: TokenDelegationConfig[] } {
    return {
      tokenDelegations: [
        {
          tokenMint: NATIVE_MINT,
          delegationType: "fee-billing" as DelegationType,
          amount: MAX_UINT64,
        },
        {
          tokenMint: config.bnmTokenMint,
          delegationType: "fee-billing" as DelegationType,
          amount: MAX_UINT64,
        },
        {
          tokenMint: config.linkTokenMint,
          delegationType: "fee-billing" as DelegationType,
          amount: MAX_UINT64,
        },
      ],
    };
  }

  /**
   * Checks if a token account exists and creates it if needed
   */
  private async checkAndCreateTokenAccount(
    connection: Connection,
    tokenMint: PublicKey,
    owner: PublicKey,
    tokenProgramId: PublicKey
  ): Promise<{ createATAInstructions: TransactionInstruction[], ataExists: boolean }> {
    const tokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      owner,
      false,
      tokenProgramId
    );

    let createATAInstructions: TransactionInstruction[] = [];
    let ataExists = false;

    try {
      const accountInfo = await connection.getAccountInfo(tokenAccount);
      ataExists = accountInfo !== null;
      
      if (!ataExists) {
        this.logger.info(`Token account ${tokenAccount.toString()} does not exist. Adding instruction to create it.`);
        createATAInstructions.push(
          createAssociatedTokenAccountInstruction(
            owner,
            tokenAccount,
            owner,
            tokenMint,
            tokenProgramId
          )
        );
      } else {
        this.logger.info(`Token account ${tokenAccount.toString()} exists.`);
      }
    } catch (error) {
      this.logger.error(`Error checking token account: ${error instanceof Error ? error.message : String(error)}`);
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
   * Resolve delegate address based on delegation type
   */
  private async resolveDelegateAddress(
    delegationType: DelegationType,
    routerProgramId: PublicKey,
    tokenMint: PublicKey,
    customDelegate?: string,
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
          const [tokenPoolSignerPDA] = await findDynamicTokenPoolsSignerPDA(
            tokenMint,
            routerProgramId,
            connection
          );
          return tokenPoolSignerPDA;
        } catch (error) {
          const [tokenPoolsSignerPDA] = findExternalTokenPoolsSignerPDA(routerProgramId);
          return tokenPoolsSignerPDA;
        }
      }
      case "custom": {
        if (!customDelegate) {
          throw new Error("Custom delegate address required for custom delegation type");
        }
        return new PublicKey(customDelegate);
      }
      default:
        throw new Error(`Unknown delegation type: ${delegationType}`);
    }
  }

  /**
   * Process a single token delegation
   */
  private async processTokenDelegation(
    delegation: TokenDelegationConfig,
    walletKeypair: Signer,
    routerProgramId: PublicKey,
    connection: Connection,
    config: any
  ): Promise<void> {
    try {
      const tokenMint = delegation.tokenMint instanceof PublicKey
        ? delegation.tokenMint
        : new PublicKey(delegation.tokenMint.toString());

      // Determine token program ID
      let tokenProgramId: PublicKey;
      if (delegation.tokenProgramId) {
        tokenProgramId = delegation.tokenProgramId instanceof PublicKey
          ? delegation.tokenProgramId
          : new PublicKey(delegation.tokenProgramId.toString());
        this.logger.info(`Using provided token program ID: ${tokenProgramId.toString()}`);
      } else {
        tokenProgramId = await detectTokenProgram(tokenMint, connection, this.logger);
      }

      // Resolve delegate address
      const delegateAddress = await this.resolveDelegateAddress(
        delegation.delegationType,
        routerProgramId,
        tokenMint,
        delegation.customDelegate?.toString(),
        connection
      );

      const amountToDelegate = BigInt(delegation.amount);

      this.logger.info(`Token Program ID: ${tokenProgramId.toString()}`);
      this.logger.info(`Delegation Type: ${delegation.delegationType}`);
      this.logger.info(`Delegate Address: ${delegateAddress.toString()}`);
      this.logger.info(`Amount to delegate: ${amountToDelegate.toString()}`);

      // Get user's token account
      const userTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        walletKeypair.publicKey,
        false,
        tokenProgramId
      );

      this.logger.info(`User Token Account: ${userTokenAccount.toString()}`);

      // Check and create token account if needed
      const { createATAInstructions } = await this.checkAndCreateTokenAccount(
        connection,
        tokenMint,
        walletKeypair.publicKey,
        tokenProgramId
      );

      // Create approve instruction
      const approveInstruction = createApproveInstruction(
        userTokenAccount,
        delegateAddress,
        walletKeypair.publicKey,
        amountToDelegate,
        [],
        tokenProgramId
      );

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash({
        commitment: "finalized"
      });

      // Create transaction
      const transaction = new Transaction({
        feePayer: walletKeypair.publicKey,
        blockhash,
        lastValidBlockHeight
      });
      
      // Add instructions
      if (createATAInstructions.length > 0) {
        transaction.add(...createATAInstructions);
      }
      transaction.add(approveInstruction);

      this.logger.info("Sending transaction to delegate token authority...");
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [walletKeypair],
        { 
          skipPreflight: this.options.skipPreflight, 
          commitment: "confirmed",
          maxRetries: SCRIPT_CONFIG.retries,
          preflightCommitment: "processed"
        }
      );

      this.logger.info(`✅ Token delegation successful!`);
      this.logger.info(`Transaction signature: ${signature}`);
      const explorerCluster = config.id === 'solana-mainnet' ? '' : '?cluster=devnet';
      this.logger.info(`Explorer URL: https://explorer.solana.com/tx/${signature}${explorerCluster}`);

    } catch (error) {
      this.logger.error(
        `❌ Error delegating token authority:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  protected async execute(): Promise<void> {
    this.logger.info("CCIP Token Authority Delegator");
    this.logger.info("=============================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Router Program: ${config.routerProgramId.toString()}`);
    this.logger.info(`Wallet: ${walletKeypair.publicKey.toString()}`);

    // Check SOL balance
    this.logger.info("");
    this.logger.info("💰 WALLET BALANCE");
    this.logger.info("=============================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    this.logger.info(`SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL (${balance} lamports)`);

    if (balance < SCRIPT_CONFIG.minSolRequired * LAMPORTS_PER_SOL) {
      throw new Error(
        `Insufficient SOL balance. You need at least ${SCRIPT_CONFIG.minSolRequired} SOL for transaction fees.`
      );
    }

    this.logger.info("");
    this.logger.info("🔐 PROCESSING TOKEN DELEGATIONS");
    this.logger.info("=============================================");

    let tokenDelegations: TokenDelegationConfig[] = [];

    if (this.options.tokenMint) {
      // Handle custom token mints
      const tokenMints = this.options.tokenMint.split(',').map(mint => mint.trim());
      this.logger.info(`Custom token mints provided: ${tokenMints.join(', ')}`);

      let effectiveDelegationType: DelegationType = "fee-billing";
      let customDelegateAddress: string | undefined = undefined;
      
      if (this.options.delegationType === "custom") {
        if (!this.options.customDelegate) {
          throw new Error("Custom delegate address required when delegation-type is 'custom'");
        }
        effectiveDelegationType = "custom";
        customDelegateAddress = this.options.customDelegate;
        this.logger.info("Using custom delegation type for all provided tokens");
      } else if (this.options.delegationType === "token-pool") {
        this.logger.warn(
          "Warning: Delegation type 'token-pool' specified. " +
          "For ccip_send compatibility, authority will be delegated to the 'fee-billing' signer PDA."
        );
        effectiveDelegationType = "fee-billing";
      } else {
        this.logger.info("Using 'fee-billing' delegation type for ccip_send compatibility");
      }

      // Create delegation config for each token mint
      for (const tokenMint of tokenMints) {
        tokenDelegations.push({
          tokenMint: tokenMint,
          tokenProgramId: this.options.tokenProgramId,
          delegationType: effectiveDelegationType,
          customDelegate: customDelegateAddress,
          amount: MAX_UINT64,
        });
        this.logger.info(`Added custom token delegation for: ${tokenMint}`);
      }
    } else {
      // Use default tokens
      this.logger.info("No custom tokens provided, using default token configuration");
      const tokenDelegationConfig = this.createTokenDelegationConfig(config);
      tokenDelegations = [...tokenDelegationConfig.tokenDelegations];
    }

    // Process each delegation
    for (let i = 0; i < tokenDelegations.length; i++) {
      const delegation = tokenDelegations[i];
      this.logger.info(
        `\n[${i + 1}/${tokenDelegations.length}] Processing delegation for mint: ${delegation.tokenMint}`
      );

      await this.processTokenDelegation(
        delegation,
        walletKeypair,
        config.routerProgramId,
        config.connection,
        config
      );
    }

    this.logger.info("");
    this.logger.info("✅ All delegations processed successfully");
  }
}

// Create and run the command
const command = new DelegateTokenAuthorityCommand();
command.run().catch((error) => {
  process.exit(1);
});
