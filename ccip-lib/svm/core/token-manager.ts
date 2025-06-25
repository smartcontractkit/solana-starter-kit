/**
 * Token Manager Client for SPL Token and Token-2022 Operations
 *
 * This module provides a high-level client for managing both SPL Token and Token-2022 tokens
 * with Metaplex metadata, following the established patterns of the CCIP library.
 */

import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import {
  TokenCreationUtils,
  TokenConfig,
  Token2022Config,
  SplTokenConfig,
  TokenProgram,
  TokenCreationResult,
  MintResult,
  TokenOperationOptions,
} from "../utils/token-creation";
import { createLogger, LogLevel } from "../utils/logger";

/**
 * Minimal chain configuration interface for TokenManager
 * This avoids importing from ccip-scripts and keeps the library independent
 */
export interface TokenManagerChainConfig {
  id: string;
  connection: Connection;
}

/**
 * Options for TokenManager initialization
 */
export interface TokenManagerOptions {
  /** Logging level */
  logLevel?: LogLevel;
  /** Skip transaction preflight checks by default */
  skipPreflight?: boolean;
  /** Default transaction commitment level */
  commitment?: "processed" | "confirmed" | "finalized";
}

/**
 * Extended token configuration with optional overrides for Token-2022
 */
export interface ExtendedToken2022Config
  extends Omit<Token2022Config, "uri" | "tokenProgram"> {
  /** Metadata URI (optional if using inline metadata) */
  uri?: string;
  /** Inline metadata object (alternative to URI) */
  metadata?: {
    name: string;
    description: string;
    image?: string;
    external_url?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
}

/**
 * Extended token configuration with optional overrides for SPL Token
 */
export interface ExtendedSplTokenConfig
  extends Omit<SplTokenConfig, "uri" | "tokenProgram"> {
  /** Metadata URI (optional if using inline metadata) */
  uri?: string;
  /** Inline metadata object (alternative to URI) */
  metadata?: {
    name: string;
    description: string;
    image?: string;
    external_url?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
}

/**
 * High-level client for SPL Token and Token-2022 operations
 */
export class TokenManager {
  private utils: TokenCreationUtils;
  private connection: Connection;
  private options: TokenManagerOptions;
  private logger: any;
  private walletPublicKey: PublicKey;

  constructor(
    config: TokenManagerChainConfig,
    keypair: Keypair,
    options: TokenManagerOptions = {}
  ) {
    this.connection = config.connection;
    this.walletPublicKey = keypair.publicKey;
    this.options = {
      logLevel: LogLevel.INFO,
      skipPreflight: false,
      commitment: "confirmed",
      ...options,
    };

    // Initialize logger
    this.logger = createLogger("token-manager", {
      level: this.options.logLevel!,
    });

    // Initialize utilities
    this.utils = new TokenCreationUtils(
      this.connection,
      keypair,
      this.options.logLevel!
    );

    this.logger.debug("TokenManager initialized", {
      chainId: config.id,
      rpcEndpoint: this.connection.rpcEndpoint,
    });
  }

  /**
   * Create a new Token-2022 token with metadata
   */
  async createToken(
    config: ExtendedToken2022Config
  ): Promise<TokenCreationResult> {
    this.logger.info("Starting Token-2022 creation with metadata", {
      name: config.name,
      symbol: config.symbol,
      decimals: config.decimals,
      initialSupply: config.initialSupply?.toString(),
      sellerFeeBasisPoints: config.sellerFeeBasisPoints,
      hasUri: !!config.uri,
      hasInlineMetadata: !!config.metadata,
    });

    try {
      // Validate and prepare configuration
      this.logger.debug("Preparing token configuration");
      const tokenConfig = await this.prepareToken2022Config(config);

      this.logger.debug(
        "Configuration prepared, delegating to TokenCreationUtils",
        {
          uri: tokenConfig.uri,
        }
      );

      // Create the token
      const result = await this.utils.createTokenWithMetadata(
        tokenConfig,
        this.getOperationOptions()
      );

      this.logger.info("Token creation completed successfully", {
        mint: result.mint.toString(),
        signature: result.signature,
        tokenAccount: result.tokenAccount?.toString(),
        hasTokenAccount: !!result.tokenAccount,
      });

      return result;
    } catch (error) {
      this.logger.error("Failed to create token", {
        error: error instanceof Error ? error.message : String(error),
        name: config.name,
        symbol: config.symbol,
        decimals: config.decimals,
      });
      throw error;
    }
  }

  /**
   * Create a new SPL Token with metadata
   */
  async createSplToken(
    config: ExtendedSplTokenConfig
  ): Promise<TokenCreationResult> {
    this.logger.info("Starting SPL Token creation with metadata", {
      name: config.name,
      symbol: config.symbol,
      decimals: config.decimals,
      initialSupply: config.initialSupply?.toString(),
      sellerFeeBasisPoints: config.sellerFeeBasisPoints,
      hasUri: !!config.uri,
      hasInlineMetadata: !!config.metadata,
    });

    try {
      // Validate and prepare configuration
      this.logger.debug("Preparing token configuration");
      const tokenConfig = await this.prepareSplTokenConfig(config);

      this.logger.debug(
        "Configuration prepared, delegating to TokenCreationUtils",
        {
          uri: tokenConfig.uri,
        }
      );

      // Create the token
      const result = await this.utils.createTokenWithMetadata(
        tokenConfig,
        this.getOperationOptions()
      );

      this.logger.info("Token creation completed successfully", {
        mint: result.mint.toString(),
        signature: result.signature,
        tokenAccount: result.tokenAccount?.toString(),
        hasTokenAccount: !!result.tokenAccount,
      });

      return result;
    } catch (error) {
      this.logger.error("Failed to create token", {
        error: error instanceof Error ? error.message : String(error),
        name: config.name,
        symbol: config.symbol,
        decimals: config.decimals,
      });
      throw error;
    }
  }

  /**
   * Mint tokens to a specific recipient (creates ATA if needed)
   */
  async mintTokens(
    mint: PublicKey,
    amount: bigint,
    recipient?: PublicKey
  ): Promise<MintResult> {
    const recipientKey = recipient || this.getDefaultRecipient();

    this.logger.info("Starting token mint operation", {
      mint: mint.toString(),
      amount: amount.toString(),
      recipient: recipientKey.toString(),
      isDefaultRecipient: !recipient,
    });

    try {
      this.logger.debug("Delegating to TokenCreationUtils for minting");

      const result = await this.utils.mintToAssociatedAccount(
        mint,
        amount,
        recipientKey,
        undefined, // Use default token program (TOKEN_2022)
        this.getOperationOptions()
      );

      this.logger.info("Token mint operation completed successfully", {
        signature: result.signature,
        amount: result.amount.toString(),
        tokenAccount: result.tokenAccount.toString(),
        newBalance: result.newBalance,
      });

      return result;
    } catch (error) {
      this.logger.error("Failed to mint tokens", {
        error: error instanceof Error ? error.message : String(error),
        mint: mint.toString(),
        amount: amount.toString(),
        recipient: recipientKey.toString(),
      });
      throw error;
    }
  }

  /**
   * Get or create an Associated Token Account
   */
  async getOrCreateATA(mint: PublicKey, owner?: PublicKey): Promise<PublicKey> {
    const ownerKey = owner || this.getDefaultRecipient();

    this.logger.debug("Starting ATA resolution", {
      mint: mint.toString(),
      owner: ownerKey.toString(),
      isDefaultOwner: !owner,
    });

    try {
      this.logger.debug("Delegating to TokenCreationUtils for ATA resolution");

      const tokenAccount = await this.utils.findOrCreateATA(
        mint,
        ownerKey,
        undefined, // Use default token program (TOKEN_2022)
        this.getOperationOptions()
      );

      this.logger.debug("ATA resolution completed successfully", {
        tokenAccount: tokenAccount.toString(),
        mint: mint.toString(),
        owner: ownerKey.toString(),
      });

      return tokenAccount;
    } catch (error) {
      this.logger.error("Failed to get or create ATA", {
        error: error instanceof Error ? error.message : String(error),
        mint: mint.toString(),
        owner: ownerKey.toString(),
      });
      throw error;
    }
  }

  /**
   * Get token balance for an account
   */
  async getTokenBalance(tokenAccount: PublicKey): Promise<bigint> {
    this.logger.debug("Starting token balance lookup", {
      tokenAccount: tokenAccount.toString(),
    });

    try {
      this.logger.debug("Delegating to TokenCreationUtils for balance lookup");

      const balance = await this.utils.getTokenBalance(tokenAccount);

      this.logger.debug("Token balance lookup completed successfully", {
        tokenAccount: tokenAccount.toString(),
        balance: balance.toString(),
      });

      return balance;
    } catch (error) {
      this.logger.error("Failed to get token balance", {
        error: error instanceof Error ? error.message : String(error),
        tokenAccount: tokenAccount.toString(),
      });
      throw error;
    }
  }

  /**
   * Prepare Token-2022 configuration, handling metadata URI generation if needed
   */
  private async prepareToken2022Config(
    config: ExtendedToken2022Config
  ): Promise<Token2022Config> {
    this.logger.trace("Preparing Token-2022 configuration", {
      hasUri: !!config.uri,
      hasInlineMetadata: !!config.metadata,
    });

    if (config.uri) {
      this.logger.debug("Using provided metadata URI", {
        uri: config.uri,
      });

      // URI provided, use as-is
      return {
        name: config.name,
        symbol: config.symbol,
        uri: config.uri,
        decimals: config.decimals,
        initialSupply: config.initialSupply,
        sellerFeeBasisPoints: config.sellerFeeBasisPoints,
        tokenProgram: TokenProgram.TOKEN_2022,
      };
    }

    if (config.metadata) {
      this.logger.error(
        "Inline metadata upload attempted but not implemented",
        {
          metadata: config.metadata,
        }
      );
      // Inline metadata provided, we would need to upload to IPFS/Arweave
      // For now, we'll require a URI to be provided
      throw new Error(
        "Inline metadata upload not implemented. Please provide a metadata URI."
      );
    }

    this.logger.error("No metadata URI or inline metadata provided");
    throw new Error("Either 'uri' or 'metadata' must be provided");
  }

  /**
   * Prepare SPL Token configuration, handling metadata URI generation if needed
   */
  private async prepareSplTokenConfig(
    config: ExtendedSplTokenConfig
  ): Promise<SplTokenConfig> {
    this.logger.trace("Preparing SPL Token configuration", {
      hasUri: !!config.uri,
      hasInlineMetadata: !!config.metadata,
    });

    if (config.uri) {
      this.logger.debug("Using provided metadata URI", {
        uri: config.uri,
      });

      // URI provided, use as-is
      return {
        name: config.name,
        symbol: config.symbol,
        uri: config.uri,
        decimals: config.decimals,
        initialSupply: config.initialSupply,
        sellerFeeBasisPoints: config.sellerFeeBasisPoints,
        tokenProgram: TokenProgram.SPL_TOKEN,
      };
    }

    if (config.metadata) {
      this.logger.error(
        "Inline metadata upload attempted but not implemented",
        {
          metadata: config.metadata,
        }
      );
      // Inline metadata provided, we would need to upload to IPFS/Arweave
      // For now, we'll require a URI to be provided
      throw new Error(
        "Inline metadata upload not implemented. Please provide a metadata URI."
      );
    }

    this.logger.error("No metadata URI or inline metadata provided");
    throw new Error("Either 'uri' or 'metadata' must be provided");
  }

  /**
   * Get operation options with defaults
   */
  private getOperationOptions(): TokenOperationOptions {
    return {
      skipPreflight: this.options.skipPreflight,
      commitment: this.options.commitment,
    };
  }

  /**
   * Get default recipient (the wallet that initialized this manager)
   */
  private getDefaultRecipient(): PublicKey {
    return this.walletPublicKey;
  }
}
