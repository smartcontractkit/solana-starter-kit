/**
 * SPL Token Minting Script (CLI Framework Version)
 *
 * This script mints tokens to a specified recipient's associated token account.
 * If the associated token account doesn't exist, it will be created automatically.
 * Works with any SPL Token or Token-2022 mint where you have minting authority.
 */

import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TokenManager,
  TokenManagerOptions,
  LogLevel,
  createLogger,
} from "../../../ccip-lib/svm";
import { loadKeypair, getKeypairPath } from "../utils";
import {
  ChainId,
  getCCIPSVMConfig,
  resolveNetworkConfig,
  getExplorerUrl,
  getExplorerAddressUrl,
} from "../../config";
import { CCIPCommand, ArgumentDefinition, CommandMetadata, BaseCommandOptions } from "../utils/cli-framework";

/**
 * Configuration for token minting operations
 */
const TOKEN_MINTING_CONFIG = {
  minSolRequired: 0.005,
  defaultLogLevel: LogLevel.INFO,
};

/**
 * Options specific to the mint-tokens command
 */
interface MintTokensOptions extends BaseCommandOptions {
  mint: string;
  amount: string;
  recipient?: string;
}

/**
 * Token information interface
 */
interface TokenInfo {
  decimals: number;
  supply: string;
}

/**
 * SPL Token Minting Command
 */
class MintTokensCommand extends CCIPCommand<MintTokensOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "mint-tokens",
      description: "🪙 SPL Token Minting Tool\n\nMints tokens to a specified recipient's associated token account. Works with SPL Token and Token-2022 mints where you have minting authority.",
      examples: [
        "# Mint 1000 tokens to your wallet",
        "yarn svm:token:mint --mint 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM --amount 1000",
        "",
        "# Mint 500 tokens to another wallet",
        "yarn svm:token:mint --mint 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM --amount 500 --recipient 5vXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "",
        "# Mint with debugging enabled",
        "yarn svm:token:mint --mint 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM --amount 100 --log-level DEBUG",
        "",
        "# Mint fractional amounts",
        "yarn svm:token:mint --mint 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM --amount 1.5"
      ],
      notes: [
        "You must be the mint authority of the token to mint new tokens",
        "Associated Token Accounts (ATAs) are created automatically if they don't exist",
        "Transaction fees are paid from your wallet's SOL balance",
        "Amounts are specified in token units (e.g., 1.5 tokens, not raw amounts)",
        "Supports both SPL Token and Token-2022 programs",
        "Minimum 0.005 SOL required for transaction fees"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "mint",
        required: true,
        type: "string",
        description: "Token mint address",
        example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
      },
      {
        name: "amount",
        required: true,
        type: "string",
        description: "Amount to mint in token units",
        example: "1000"
      },
      {
        name: "recipient",
        required: false,
        type: "string",
        description: "Recipient wallet address (defaults to your wallet if not provided)",
        example: "5vXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
      }
    ];
  }

  /**
   * Validate token minting configuration
   */
  private validateConfig(): void {
    const errors: string[] = [];

    // Validate mint address
    try {
      new PublicKey(this.options.mint);
    } catch {
      errors.push("Invalid mint address format");
    }

    // Validate amount
    const amount = parseFloat(this.options.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push("Amount must be a positive number");
    }

    // Validate recipient if provided
    if (this.options.recipient) {
      try {
        new PublicKey(this.options.recipient);
      } catch {
        errors.push("Invalid recipient address format");
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Configuration validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`
      );
    }
  }

  /**
   * Get token information from mint address
   */
  private async getTokenInfo(mint: PublicKey, config: any): Promise<TokenInfo> {
    try {
      const mintInfo = await config.connection.getParsedAccountInfo(mint);

      if (!mintInfo.value || !mintInfo.value.data || typeof mintInfo.value.data === "string") {
        throw new Error("Invalid mint account or unable to parse mint data");
      }

      const data = mintInfo.value.data as any;
      if (data.program !== "spl-token-2022" && data.program !== "spl-token") {
        throw new Error("Account is not a valid SPL token mint");
      }

      return {
        decimals: data.parsed.info.decimals,
        supply: data.parsed.info.supply,
      };
    } catch (error) {
      throw new Error(
        `Failed to get token info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Convert amount from token units to raw token amount
   */
  private convertToRawAmount(amount: string, decimals: number): bigint {
    const amountFloat = parseFloat(amount);
    const multiplier = Math.pow(10, decimals);
    const rawAmount = Math.floor(amountFloat * multiplier);
    return BigInt(rawAmount);
  }

  /**
   * Format raw token amount to human-readable units
   */
  private formatTokenAmount(rawAmount: string, decimals: number): string {
    const amount = BigInt(rawAmount);
    const divisor = BigInt(Math.pow(10, decimals));
    const wholePart = amount / divisor;
    const fractionalPart = amount % divisor;

    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }

    const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
    const trimmedFractional = fractionalStr.replace(/0+$/, "");

    return trimmedFractional ? `${wholePart}.${trimmedFractional}` : wholePart.toString();
  }

  protected async execute(): Promise<void> {
    this.logger.info("SPL Token Minting Tool");
    this.logger.info("=================================");

    // Resolve network configuration
    const config = resolveNetworkConfig(this.options);
    
    // Load wallet
    const keypairPath = getKeypairPath(this.options);
    const walletKeypair = loadKeypair(keypairPath);
    
    this.logger.info(`Network: ${config.id}`);
    this.logger.info(`Wallet: ${walletKeypair.publicKey.toString()}`);

    // Check SOL balance
    this.logger.info("");
    this.logger.info("💰 WALLET BALANCE");
    this.logger.info("=================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalanceDisplay = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalanceDisplay.toFixed(9)} SOL)`);

    if (solBalanceDisplay < TOKEN_MINTING_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient SOL balance. Need at least ${TOKEN_MINTING_CONFIG.minSolRequired} SOL for transaction fees. ` +
        `Current balance: ${solBalanceDisplay.toFixed(9)} SOL`
      );
    }

    // Validate configuration
    this.validateConfig();

    const mintAddress = new PublicKey(this.options.mint);
    const recipientAddress = this.options.recipient
      ? new PublicKey(this.options.recipient)
      : walletKeypair.publicKey;

    // Get token information
    this.logger.info("");
    this.logger.info("🪙 TOKEN INFORMATION");
    this.logger.info("=================================");
    const tokenInfo = await this.getTokenInfo(mintAddress, config);
    this.logger.info(`Mint Address: ${mintAddress.toString()}`);
    this.logger.info(`Token Decimals: ${tokenInfo.decimals}`);
    this.logger.info(
      `Current Supply: ${this.formatTokenAmount(tokenInfo.supply, tokenInfo.decimals)} tokens`
    );

    // Convert amount to raw token amount
    const rawAmount = this.convertToRawAmount(this.options.amount, tokenInfo.decimals);
    const formattedAmount = this.formatTokenAmount(rawAmount.toString(), tokenInfo.decimals);

    this.logger.info("");
    this.logger.info("⚙️  MINTING CONFIGURATION");
    this.logger.info("=================================");
    this.logger.info(`Amount to Mint: ${formattedAmount} tokens`);
    this.logger.info(`Raw Amount: ${rawAmount.toString()}`);
    this.logger.info(`Recipient: ${recipientAddress.toString()}`);
    if (recipientAddress.equals(walletKeypair.publicKey)) {
      this.logger.info("(Minting to your own wallet)");
    }

    // Initialize TokenManager
    const tokenManagerOptions: TokenManagerOptions = {
      logLevel: this.options.logLevel ?? TOKEN_MINTING_CONFIG.defaultLogLevel,
      skipPreflight: this.options.skipPreflight,
      commitment: "finalized",
    };

    const tokenManager = new TokenManager(config, walletKeypair, tokenManagerOptions);

    // Check if ATA exists and get/create it
    this.logger.info("");
    this.logger.info("🔗 ASSOCIATED TOKEN ACCOUNT");
    this.logger.info("=================================");
    const ata = await tokenManager.getOrCreateATA(mintAddress, recipientAddress);
    this.logger.info(`Token Account: ${ata.toString()}`);

    // Get current balance before minting
    let currentBalance: bigint;
    try {
      currentBalance = await tokenManager.getTokenBalance(ata);
      this.logger.info(
        `Current Balance: ${this.formatTokenAmount(
          currentBalance.toString(),
          tokenInfo.decimals
        )} tokens`
      );
    } catch {
      this.logger.info("Current Balance: 0 tokens (new account)");
      currentBalance = BigInt(0);
    }

    // Mint the tokens
    this.logger.info("");
    this.logger.info("🏭 MINTING TOKENS");
    this.logger.info("=================================");
    const result = await tokenManager.mintTokens(mintAddress, rawAmount, recipientAddress);

    // Display results
    this.logger.info("");
    this.logger.info("✅ TOKENS MINTED SUCCESSFULLY");
    this.logger.info("=================================");
    this.logger.info(`Transaction Signature: ${result.signature}`);
    this.logger.info(
      `Amount Minted: ${this.formatTokenAmount(
        result.amount.toString(),
        tokenInfo.decimals
      )} tokens`
    );
    this.logger.info(
      `New Balance: ${this.formatTokenAmount(result.newBalance, tokenInfo.decimals)} tokens`
    );
    this.logger.info(`Token Account: ${result.tokenAccount.toString()}`);

    // Calculate and display the change
    const newBalanceBigInt = BigInt(result.newBalance);
    const balanceIncrease = newBalanceBigInt - currentBalance;
    this.logger.info(
      `Balance Increase: +${this.formatTokenAmount(
        balanceIncrease.toString(),
        tokenInfo.decimals
      )} tokens`
    );

    // Display explorer URLs
    this.logger.info("");
    this.logger.info("🔍 EXPLORER URLS");
    this.logger.info("=================================");
    this.logger.info(`Transaction: ${getExplorerUrl(config.id, result.signature)}`);
    this.logger.info(
      `Token Account: ${getExplorerAddressUrl(config.id, result.tokenAccount.toString())}`
    );
    this.logger.info(`Mint: ${getExplorerAddressUrl(config.id, mintAddress.toString())}`);

    this.logger.info("");
    this.logger.info("🎉 Token minting completed successfully!");
  }
}

// Create and run the command
const command = new MintTokensCommand();
command.run().catch((error) => {
  process.exit(1);
});
