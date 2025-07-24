/**
 * Token Approval Checker (CLI Framework Version)
 *
 * This script checks token approvals for various tokens and their delegation
 * status for CCIP operations. All tokens used in ccip_send transactions
 * MUST be delegated to the appropriate signer PDA.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAccount,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
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
 * Options specific to the check-token-approval command
 */
interface CheckTokenApprovalOptions extends BaseCommandOptions {
  tokenMint?: string;
  delegationType?: DelegationType;
  customDelegate?: string;
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

/**
 * Token Approval Checker Command
 */
class CheckTokenApprovalCommand extends CCIPCommand<CheckTokenApprovalOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "check-token-approval",
      description: "🔍 CCIP Token Approval Checker\n\nChecks token approvals and delegation status for CCIP operations. All tokens used in ccip_send transactions MUST be delegated to the appropriate signer PDA.",
      examples: [
        "# Check default tokens (wSOL, BnM, LINK)",
        "yarn svm:token:check-token-approval",
        "",
        "# Check specific token",
        "yarn svm:token:check-token-approval --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        "",
        "# Check multiple tokens (comma-separated)",
        "yarn svm:token:check-token-approval --token-mint \"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU,So11111111111111111111111111111111111111112\"",
        "",
        "# Check with custom delegation type",
        "yarn svm:token:check-token-approval --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --delegation-type token-pool",
        "",
        "# Check with custom delegate address",
        "yarn svm:token:check-token-approval --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU --delegation-type custom --custom-delegate 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T"
      ],
      notes: [
        "All tokens for ccip_send MUST be delegated to 'fee-billing' signer PDA",
        "BnM tokens require 'fee-billing' delegation for cross-chain transfers",
        "Multiple token mints can be checked using comma-separated values",
        "Router program ID is automatically loaded from CCIP configuration",
        "Delegation types: fee-billing (default), token-pool, custom",
        "Custom delegation type requires --custom-delegate parameter"
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
        description: "Token mint address(es) to check (comma-separated for multiple). If not provided, checks default tokens (wSOL, BnM, LINK)",
        example: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
      },
      {
        name: "delegation-type",
        required: false,
        type: "string",
        description: "Expected delegation type: fee-billing (default), token-pool, or custom",
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
   * Create token approval configuration based on network config
   */
  private createTokenApprovalConfig(config: any): { tokensToCheck: TokenApprovalConfig[] } {
    return {
      tokensToCheck: [
        {
          tokenMint: NATIVE_MINT,
          description: "Wrapped SOL (wSOL)",
          delegationType: "fee-billing" as DelegationType,
        },
        {
          tokenMint: config.bnmTokenMint,
          description: "BnM Token",
          delegationType: "fee-billing" as DelegationType,
        },
        {
          tokenMint: config.linkTokenMint,
          description: "LINK Token",
          delegationType: "fee-billing" as DelegationType,
        },
      ],
    };
  }

  /**
   * Resolve delegate address based on delegation type
   */
  private async resolveDelegateAddress(
    delegationType: DelegationType,
    routerProgramId: PublicKey,
    tokenMint: PublicKey,
    customDelegate?: string,
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
   * Check token approvals for a list of token mints
   */
  private async checkTokenApprovals(
    mints: TokenApprovalConfig[],
    connection: any,
    walletPublicKey: PublicKey,
    routerProgramId: PublicKey
  ): Promise<TokenApprovalStatus[]> {
    const results: TokenApprovalStatus[] = [];

    for (let i = 0; i < mints.length; i++) {
      const tokenConfig = mints[i];

      try {
        if (!tokenConfig.tokenMint) {
          this.logger.warn(`Skipping token with null mint in position ${i}`);
          continue;
        }

        const tokenMint = tokenConfig.tokenMint instanceof PublicKey
          ? tokenConfig.tokenMint
          : new PublicKey(tokenConfig.tokenMint.toString());

        this.logger.info(`\n[${i + 1}/${mints.length}] Processing token: ${tokenConfig.description}`);
        this.logger.info(`Mint: ${tokenMint.toString()}`);

        const tokenProgramId = await detectTokenProgram(tokenMint, connection, this.logger);
        this.logger.info(`Token Program ID: ${tokenProgramId.toString()}`);

        const tokenAccount = getAssociatedTokenAddressSync(
          tokenMint,
          walletPublicKey,
          false,
          tokenProgramId
        );
        this.logger.info(`Token Account: ${tokenAccount.toString()}`);

        const expectedDelegate = await this.resolveDelegateAddress(
          tokenConfig.delegationType,
          routerProgramId,
          tokenMint,
          this.options.customDelegate,
          connection
        );

        this.logger.info(`Expected Delegate (${tokenConfig.delegationType}): ${expectedDelegate.toString()}`);

        try {
          const tokenAccountInfo = await getAccount(
            connection,
            tokenAccount,
            connection.commitment,
            tokenProgramId
          );

          const delegateAddress = tokenAccountInfo.delegate;
          const delegatedAmount = tokenAccountInfo.delegatedAmount;
          const balance = tokenAccountInfo.amount;

          const matchesExpectedDelegate = delegateAddress !== null && 
            expectedDelegate !== null && 
            delegateAddress.equals(expectedDelegate);

          this.logger.info(`Balance: ${balance.toString()}`);

          if (delegateAddress !== null) {
            this.logger.info(`Actual Delegate: ${delegateAddress.toString()}`);
            this.logger.info(`Delegated Amount: ${delegatedAmount.toString()}`);
            this.logger.info(`Matches Expected Delegate: ${matchesExpectedDelegate ? "✓ Yes" : "✗ No"}`);
          } else {
            this.logger.info("No delegate set for this token account");
          }

          results.push({
            mint: tokenMint,
            tokenAccount,
            description: tokenConfig.description,
            balance: balance.toString(),
            delegate: delegateAddress,
            delegatedAmount: delegatedAmount.toString(),
            hasDelegate: delegateAddress !== null,
            expectedDelegate,
            matchesExpectedDelegate: delegateAddress !== null ? matchesExpectedDelegate : false,
          });
        } catch (error) {
          this.logger.warn(`Error fetching token account: Account may not exist`);
          if (error instanceof Error) {
            this.logger.debug(`Error details: ${error.message}`);
          }

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
        this.logger.error(
          `❌ Error processing token ${tokenConfig.description}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    return results;
  }

  protected async execute(): Promise<void> {
    this.logger.info("CCIP Token Approval Checker");
    this.logger.info("=========================================");

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
    this.logger.info("=========================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    this.logger.info(`SOL Balance: ${balance / LAMPORTS_PER_SOL} SOL (${balance} lamports)`);

    this.logger.info("");
    this.logger.info("🔍 PROCESSING TOKEN APPROVALS");
    this.logger.info("=========================================");

    let tokensToCheck: TokenApprovalConfig[] = [];

    if (this.options.tokenMint) {
      // Handle custom token mints
      const tokenMints = this.options.tokenMint.split(',').map(mint => mint.trim());
      this.logger.info(`Custom token mints provided: ${tokenMints.join(', ')}`);

      let effectiveDelegationType: DelegationType = "fee-billing";
      
      if (this.options.delegationType === "custom") {
        if (!this.options.customDelegate) {
          throw new Error("Custom delegate address required when delegation-type is 'custom'");
        }
        effectiveDelegationType = "custom";
        this.logger.info("Using custom delegation type for all provided tokens");
      } else if (this.options.delegationType === "token-pool") {
        this.logger.warn(
          "Warning: Delegation type 'token-pool' specified. " +
          "For ccip_send compatibility, checking against 'fee-billing' signer PDA."
        );
        effectiveDelegationType = "fee-billing";
      } else {
        this.logger.info("Using 'fee-billing' delegation type for ccip_send compatibility");
      }

      // Create config for each token mint
      for (const tokenMint of tokenMints) {
        tokensToCheck.push({
          tokenMint: tokenMint,
          description: `Custom Token (${tokenMint.slice(0, 8)}...)`,
          delegationType: effectiveDelegationType,
        });
        this.logger.info(`Added custom token check for: ${tokenMint}`);
      }
    } else {
      // Use default tokens
      this.logger.info("No custom tokens provided, using default token configuration");
      const tokenApprovalConfig = this.createTokenApprovalConfig(config);
      tokensToCheck = [...tokenApprovalConfig.tokensToCheck];
    }

    const results = await this.checkTokenApprovals(
      tokensToCheck,
      config.connection,
      walletKeypair.publicKey,
      config.routerProgramId
    );

    // Display results
    this.logger.info("");
    this.logger.info("📋 TOKEN APPROVAL SUMMARY");
    this.logger.info("=========================================");
    this.logger.info("Token | Description | Balance | Delegate | Delegated Amount | Status");
    this.logger.info("------|-------------|---------|----------|-----------------|-------");

    for (const result of results) {
      this.logger.info(
        `${result.mint.toString().slice(0, 8)}... | ` +
        `${result.description} | ` +
        `${result.balance} | ` +
        `${result.delegate ? result.delegate.toString().slice(0, 8) + "..." : "None"} | ` +
        `${result.delegatedAmount} | ` +
        `${result.hasDelegate ? 
          (result.matchesExpectedDelegate ? "✓ Correct" : "✗ Wrong") : 
          "No Delegate"}`
      );
    }

    this.logger.info("");
    this.logger.info("✅ Token approval check completed successfully");
  }
}

// Create and run the command
const command = new CheckTokenApprovalCommand();
command.run().catch((error) => {
  process.exit(1);
});
