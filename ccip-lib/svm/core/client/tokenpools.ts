import { PublicKey } from "@solana/web3.js";
import { CCIPContext } from "../models";
import { createLogger, Logger, LogLevel } from "../../utils/logger";
import { TokenPoolClient } from "../../tokenpools/abstract";
import { TokenPoolFactory, TokenPoolProgramIds } from "../../tokenpools/factory";
import { TokenPoolType } from "../../tokenpools";
import { TokenRegistryClient } from "./tokenregistry";

/**
 * Manages token pool operations for CCIP
 */
export class TokenPoolManager {
  private readonly logger: Logger;
  private readonly registryClient: TokenRegistryClient;

  /**
   * Creates a new TokenPoolManager
   * @param context CCIP context
   * @param programIds Map of program IDs for different token pool types
   */
  constructor(
    private readonly context: CCIPContext,
    private readonly programIds: TokenPoolProgramIds
  ) {
    this.logger =
      context.logger ??
      createLogger("token-pool-manager", { level: LogLevel.INFO });
    this.registryClient = new TokenRegistryClient(context, context.config.ccipRouterProgramId);
    this.logger.debug("TokenPoolManager initialized");
  }

  /**
   * Get a token pool client for a specific pool type
   * @param type Pool type to use
   * @returns TokenPoolClient instance for the specified type
   */
  getTokenPoolClient(type: TokenPoolType): TokenPoolClient {
    this.logger.debug(`Creating token pool client of type: ${type}`);
    return TokenPoolFactory.create(type, this.context, this.programIds);
  }

  /**
   * Get the token registry client for managing token pool registrations
   * @returns TokenRegistryClient instance
   */
  getRegistryClient(): TokenRegistryClient {
    return this.registryClient;
  }

  /**
   * Detect and get the appropriate token pool client for a mint
   * This looks at on-chain accounts to determine which pool type is used
   *
   * @param mint Token mint public key
   * @returns TokenPoolClient instance for the detected pool type
   * @throws If no token pool is found for the mint
   */
  async getTokenPoolClientForMint(mint: PublicKey): Promise<TokenPoolClient> {
    this.logger.debug(`Detecting token pool type for mint: ${mint.toString()}`);
    const poolType = await TokenPoolFactory.detectPoolType(mint, this.context, this.programIds);
    return this.getTokenPoolClient(poolType);
  }
}
