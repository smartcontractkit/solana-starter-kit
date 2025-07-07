import { PublicKey } from "@solana/web3.js";
import { CCIPContext } from "../core/models";
import { TokenPoolClient } from "./abstract";
import { BurnMintTokenPoolClient } from "./burnmint";
import { CCIPError } from "../utils/errors";
import { createErrorEnhancer } from "../utils/errors";
import { createLogger, LogLevel } from "../utils/logger";

/**
 * Supported token pool types
 */
export enum TokenPoolType {
  /** Burn and mint token pool (burn on source, mint on destination) */
  BURN_MINT = "burn_mint",
  // Future pool types will be added here
}

/**
 * Map of program IDs for different token pool types
 */
export interface TokenPoolProgramIds {
  /** Program ID for burn-mint token pool */
  burnMint: PublicKey;
  // Future pool types will be added here
}

/**
 * Factory for creating token pool clients
 */
export class TokenPoolFactory {
  /**
   * Create a token pool client of the specified type
   * @param type Pool type to create
   * @param context CCIP context
   * @param programIds Map of program IDs for different token pool types
   * @returns TokenPoolClient instance
   */
  static create(
    type: TokenPoolType,
    context: CCIPContext,
    programIds: TokenPoolProgramIds
  ): TokenPoolClient {
    switch (type) {
      case TokenPoolType.BURN_MINT:
        return new BurnMintTokenPoolClient(context, programIds.burnMint);
      default:
        throw new CCIPError(`Unsupported token pool type: ${type}`, { type });
    }
  }

  /**
   * Detect the token pool type for a specific mint
   * This method examines on-chain accounts to determine the pool type
   *
   * @param mint Token mint to check
   * @param context CCIP context
   * @param programIds Map of program IDs for different token pool types
   * @returns Detected token pool type
   * @throws If no pool type can be detected
   */
  static async detectPoolType(
    mint: PublicKey,
    context: CCIPContext,
    programIds: TokenPoolProgramIds
  ): Promise<TokenPoolType> {
    const connection = context.provider.connection;
    // Create a default logger if one isn't provided in the context
    const logger =
      context.logger ??
      createLogger("token-pool-factory", { level: LogLevel.INFO });
    const enhanceError = createErrorEnhancer(logger);

    // Check if burn-mint pool exists for this mint
    try {
      // Try to create a burn-mint client and check if pool exists
      const burnMintClient = new BurnMintTokenPoolClient(
        context,
        programIds.burnMint
      );

      logger?.debug(`Checking for burn-mint pool for mint: ${mint.toString()}`);
      const hasBurnMintPool = await burnMintClient.hasPool(mint);

      if (hasBurnMintPool) {
        logger?.debug(`Detected burn-mint pool for mint: ${mint.toString()}`);
        return TokenPoolType.BURN_MINT;
      }
    } catch (error) {
      logger?.debug(
        `Error while checking burn-mint pool: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { error, mint: mint.toString() }
      );
    }

    // Add future pool type detection here
    // This is where additional pool types would be detected in order of priority
    // Each type should be wrapped in its own try-catch block so a failure in one
    // doesn't prevent checking other types

    logger.debug("No burn-mint pool found, checking for other pool types...");

    // Example of how to add support for a new pool type:
    /*
    try {
      const newPoolTypeClient = new NewPoolTypeClient(context, programIds.newPoolType);
      logger.debug(`Checking for new pool type for mint: ${mint.toString()}`);
      const hasNewPoolType = await newPoolTypeClient.hasPool(mint);
      
      if (hasNewPoolType) {
        logger?.debug(`Detected new pool type for mint: ${mint.toString()}`);
        return TokenPoolType.NEW_POOL_TYPE;
      }
    } catch (error) {
      logger?.debug(
        `Error while checking new pool type: ${error instanceof Error ? error.message : String(error)}`,
        { error, mint: mint.toString() }
      );
    }
    */

    // For future development, consider implementing a registry of pool type
    // detectors that can be iterated through, rather than hardcoding each check

    logger.info(
      `No supported token pool type found for mint: ${mint.toString()}`
    );

    // If we get here, no pool type was detected
    throw enhanceError(
      new CCIPError("No token pool found", { mint: mint.toString() }),
      {
        operation: "detectPoolType",
        mint: mint.toString(),
        checked: [TokenPoolType.BURN_MINT],
      }
    );
  }
}
