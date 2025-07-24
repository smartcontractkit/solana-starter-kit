/**
 * SPL Token Creation Script with Metaplex Metadata (CLI Framework Version)
 *
 * This script creates a new SPL Token (legacy token program) with Metaplex metadata support.
 * This is the traditional SPL Token program, as opposed to Token-2022.
 */

import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TokenCreationUtils,
  SplTokenConfig,
  TokenProgram,
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
 * Configuration for SPL token creation operations
 */
const TOKEN_CREATION_CONFIG = {
  defaultName: "AEM",
  defaultSymbol: "CCIP-AEM",
  defaultDecimals: 9,
  defaultSellerFeeBasisPoints: 0,
  defaultInitialSupply: "1000000000000",
  defaultLogLevel: LogLevel.INFO,
  minSolRequired: 0.01,
  defaultMetadataUri: "https://cyan-pleasant-anteater-613.mypinata.cloud/ipfs/bafkreieirlwjqbtzniqsgcjebzexlcspcmvd4woh3ajvf2p4fuivkenw6i",
};

/**
 * Options specific to the create-token-metaplex command
 */
interface CreateTokenMetaplexOptions extends BaseCommandOptions {
  name?: string;
  symbol?: string;
  uri?: string;
  decimals?: number;
  initialSupply?: string;
  feeBasisPoints?: number;
}

/**
 * SPL Token Creation Command with Metaplex Metadata
 */
class CreateTokenMetaplexCommand extends CCIPCommand<CreateTokenMetaplexOptions> {
  constructor() {
    const metadata: CommandMetadata = {
      name: "create-token-metaplex",
      description: "🪙 SPL Token Creator with Metaplex Metadata\\n\\nCreates a new SPL Token (legacy token program) with Metaplex metadata support. This uses the traditional SPL Token program, not Token-2022.",
      examples: [
        "# Minimal token creation (uses all defaults)",
        "yarn svm:token:create-spl",
        "",
        "# Token with custom name and symbol",
        "yarn svm:token:create-spl --name \"My Token\" --symbol \"MTK\"",
        "",
        "# Token with custom metadata and supply",
        "yarn svm:token:create-spl --name \"My Token\" --symbol \"MTK\" --uri \"https://example.com/metadata.json\" --initial-supply 5000000",
        "",
        "# Token with all custom parameters",
        "yarn svm:token:create-spl --name \"My Token\" --symbol \"MTK\" --decimals 6 --initial-supply 1000000 --fee-basis-points 250"
      ],
      notes: [
        `Default name: "${TOKEN_CREATION_CONFIG.defaultName}", symbol: "${TOKEN_CREATION_CONFIG.defaultSymbol}"`,
        `Default decimals: ${TOKEN_CREATION_CONFIG.defaultDecimals}, initial supply: ${TOKEN_CREATION_CONFIG.defaultInitialSupply}`,
        "Uses sample metadata URI by default - override with --uri for production",
        "Token name max 32 characters, symbol max 10 characters",
        "Decimals range: 0-9, fee basis points range: 0-10000",
        "Minimum 0.01 SOL required for transaction fees",
        "Creates legacy SPL Token (not Token-2022)",
        "Creates both mint account and initial token supply"
      ]
    };
    
    super(metadata);
  }

  protected defineArguments(): ArgumentDefinition[] {
    return [
      {
        name: "name",
        required: false,
        type: "string",
        description: `Token name (max 32 characters, default: "${TOKEN_CREATION_CONFIG.defaultName}")`,
        example: "My Token"
      },
      {
        name: "symbol",
        required: false,
        type: "string",
        description: `Token symbol (max 10 characters, default: "${TOKEN_CREATION_CONFIG.defaultSymbol}")`,
        example: "MTK"
      },
      {
        name: "uri",
        required: false,
        type: "string",
        description: "Metadata URI (uses sample URI if not provided - override recommended for production)",
        example: "https://example.com/metadata.json"
      },
      {
        name: "decimals",
        required: false,
        type: "number",
        description: `Number of decimal places (0-9, default: ${TOKEN_CREATION_CONFIG.defaultDecimals})`,
        example: "6"
      },
      {
        name: "initial-supply",
        required: false,
        type: "string",
        description: `Initial token supply to mint (default: ${TOKEN_CREATION_CONFIG.defaultInitialSupply})`,
        example: "1000000"
      },
      {
        name: "fee-basis-points",
        required: false,
        type: "number",
        description: `Seller fee basis points (0-10000, default: ${TOKEN_CREATION_CONFIG.defaultSellerFeeBasisPoints})`,
        example: "250"
      }
    ];
  }

  /**
   * Validate token creation configuration
   */
  private validateConfig(): void {
    const errors: string[] = [];

    if (this.options.name && this.options.name.length > 32) {
      errors.push("Token name must be 32 characters or less");
    }

    if (this.options.symbol && this.options.symbol.length > 10) {
      errors.push("Token symbol must be 10 characters or less");
    }

    if (this.options.decimals !== undefined && 
        (this.options.decimals < 0 || this.options.decimals > 9)) {
      errors.push("Decimals must be between 0 and 9");
    }

    if (this.options.feeBasisPoints !== undefined && 
        (this.options.feeBasisPoints < 0 || this.options.feeBasisPoints > 10000)) {
      errors.push("Fee basis points must be between 0 and 10000");
    }

    if (errors.length > 0) {
      throw new Error(
        `Configuration validation failed:\\n${errors.map((e) => `  - ${e}`).join("\\n")}`
      );
    }
  }

  /**
   * Create token configuration from command line options
   */
  private createTokenConfig(): SplTokenConfig {
    const name = this.options.name || TOKEN_CREATION_CONFIG.defaultName;
    const symbol = this.options.symbol || TOKEN_CREATION_CONFIG.defaultSymbol;
    const uri = this.options.uri || TOKEN_CREATION_CONFIG.defaultMetadataUri;
    
    const initialSupply = this.options.initialSupply
      ? BigInt(this.options.initialSupply)
      : BigInt(TOKEN_CREATION_CONFIG.defaultInitialSupply);

    return {
      name: name,
      symbol: symbol,
      uri: uri,
      decimals: this.options.decimals ?? TOKEN_CREATION_CONFIG.defaultDecimals,
      initialSupply: initialSupply,
      sellerFeeBasisPoints: this.options.feeBasisPoints ?? TOKEN_CREATION_CONFIG.defaultSellerFeeBasisPoints,
      tokenProgram: TokenProgram.SPL_TOKEN,
    };
  }

  protected async execute(): Promise<void> {
    this.logger.info("SPL Token Creator with Metaplex Metadata");
    this.logger.info("===============================================");

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
    this.logger.info("===============================================");
    const balance = await config.connection.getBalance(walletKeypair.publicKey);
    const solBalanceDisplay = balance / LAMPORTS_PER_SOL;
    this.logger.info(`SOL Balance: ${balance} lamports (${solBalanceDisplay.toFixed(9)} SOL)`);

    if (solBalanceDisplay < TOKEN_CREATION_CONFIG.minSolRequired) {
      throw new Error(
        `Insufficient SOL balance. Need at least ${TOKEN_CREATION_CONFIG.minSolRequired} SOL for transaction fees. ` +
        `Current balance: ${solBalanceDisplay.toFixed(9)} SOL`
      );
    }

    // Validate configuration
    this.validateConfig();

    // Create token configuration
    const tokenConfig = this.createTokenConfig();

    this.logger.info("");
    this.logger.info("⚙️  SPL TOKEN CONFIGURATION");
    this.logger.info("===============================================");
    this.logger.info(`Name: ${tokenConfig.name}${!this.options.name ? " (default)" : ""}`);
    this.logger.info(`Symbol: ${tokenConfig.symbol}${!this.options.symbol ? " (default)" : ""}`);
    this.logger.info(`Decimals: ${tokenConfig.decimals}${this.options.decimals === undefined ? " (default)" : ""}`);
    this.logger.info(`URI: ${tokenConfig.uri}${!this.options.uri ? " (default)" : ""}`);
    this.logger.info(`Initial Supply: ${tokenConfig.initialSupply?.toString() || "0"}${!this.options.initialSupply ? " (default)" : ""}`);
    this.logger.info(`Seller Fee Basis Points: ${tokenConfig.sellerFeeBasisPoints || 0}${this.options.feeBasisPoints === undefined ? " (default)" : ""}`);
    this.logger.info(`Token Program: SPL Token (legacy)`);

    // Warn if using defaults
    if (!this.options.name || !this.options.symbol) {
      this.logger.warn(
        "\\n⚠️  Using default token name/symbol. Consider providing your own with --name and --symbol for production tokens."
      );
    }
    if (!this.options.uri) {
      this.logger.warn(
        "\\n⚠️  Using default metadata URI. Consider providing your own with --uri for production tokens."
      );
    }

    // Initialize TokenCreationUtils
    const tokenUtils = new TokenCreationUtils(
      config.connection,
      walletKeypair,
      this.options.logLevel ?? TOKEN_CREATION_CONFIG.defaultLogLevel
    );

    // Create the token
    this.logger.info("");
    this.logger.info("🏭 CREATING SPL TOKEN");
    this.logger.info("===============================================");
    const result = await tokenUtils.createTokenWithMetadata(tokenConfig, {
      skipPreflight: this.options.skipPreflight,
      commitment: "finalized",
    });

    // Display results
    this.logger.info("");
    this.logger.info("✅ SPL TOKEN CREATED SUCCESSFULLY");
    this.logger.info("===============================================");
    this.logger.info(`Mint Address: ${result.mint.toString()}`);
    this.logger.info(`Transaction Signature: ${result.signature}`);
    if (result.tokenAccount) {
      this.logger.info(`Token Account: ${result.tokenAccount.toString()}`);
    }

    // Display explorer URLs
    this.logger.info("");
    this.logger.info("🔍 EXPLORER URLS");
    this.logger.info("===============================================");
    this.logger.info(`Mint: ${getExplorerAddressUrl(config.id, result.mint.toString())}`);
    this.logger.info(`Transaction: ${getExplorerUrl(config.id, result.signature)}`);
    if (result.tokenAccount) {
      this.logger.info(
        `Token Account: ${getExplorerAddressUrl(config.id, result.tokenAccount.toString())}`
      );
    }

    this.logger.info("");
    this.logger.info("🎉 SPL Token creation completed successfully!");
    this.logger.info("");
    this.logger.info("💡 You can now use this mint address for token operations:");
    this.logger.info(`   Mint Address: ${result.mint.toString()}`);
    this.logger.info("");
    this.logger.info("ℹ️  Note: This is a legacy SPL Token. For newer features, consider using Token-2022.");
  }
}

// Create and run the command
const command = new CreateTokenMetaplexCommand();
command.run().catch((error) => {
  process.exit(1);
});