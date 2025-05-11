import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { CCIPContext } from "../models";
import {
  tokenAdminRegistry,
  tokenAdminRegistryFields,
} from "../../bindings/accounts";
import { findTokenAdminRegistryPDA } from "../../utils/pdas";
import { createLogger, Logger, LogLevel } from "../../utils/logger";
import { createErrorEnhancer } from "../../utils/errors";

/**
 * Token Admin Registry account type
 */
export type TokenAdminRegistry = tokenAdminRegistryFields;

/**
 * Client for reading CCIP-related accounts
 */
export class CCIPAccountReader {
  readonly provider: AnchorProvider;
  readonly programId: PublicKey;
  private readonly logger: Logger;

  /**
   * Creates a new CCIPAccountReader using a context
   * @param context SDK context with provider, config and logger
   */
  constructor(readonly context: CCIPContext) {
    this.logger =
      context.logger ??
      createLogger("account-reader", { level: LogLevel.INFO });

    // Use the provider from the context to create an AnchorProvider
    this.provider = new AnchorProvider(
      context.provider.connection,
      context.provider.wallet as any, // Cast to any to satisfy AnchorProvider
      {}
    );

    // Set Anchor provider globally
    anchor.setProvider(this.provider);

    // Use router from config
    this.programId = context.config.ccipRouterProgramId;

    this.logger.debug(
      `CCIPAccountReader initialized: programId=${this.programId.toString()}`
    );
  }

  /**
   * Fetches a token admin registry account
   * @param mint Token mint
   * @returns Token admin registry account
   */
  async getTokenAdminRegistry(mint: PublicKey): Promise<TokenAdminRegistry> {
    const enhanceError = createErrorEnhancer(this.logger);

    try {
      this.logger.debug(
        `Fetching token admin registry for mint: ${mint.toString()}`
      );
      this.logger.trace(`Router program ID: ${this.programId.toString()}`);
      const [pda] = findTokenAdminRegistryPDA(mint, this.programId);
      this.logger.trace(`Token admin registry PDA: ${pda.toString()}`);

      // Use the generated tokenAdminRegistry.fetch method
      const tokenRegistry = await tokenAdminRegistry.fetch(
        this.context.provider.connection,
        pda,
        this.programId
      );

      if (!tokenRegistry) {
        throw new Error(
          `Token admin registry not found for mint: ${mint.toString()}`
        );
      }

      this.logger.trace("Retrieved token admin registry:", {
        pda: pda.toString(),
        mint: tokenRegistry.mint.toString(),
        administrator: tokenRegistry.administrator.toString(),
        lookupTable: tokenRegistry.lookupTable.toString(),
      });

      return tokenRegistry;
    } catch (error) {
      throw enhanceError(error, {
        operation: "getTokenAdminRegistry",
        mint: mint.toString(),
        programId: this.programId.toString(),
      });
    }
  }
}
