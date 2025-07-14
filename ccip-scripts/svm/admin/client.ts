import { PublicKey, Connection } from "@solana/web3.js";
import { createLogger } from "../../../ccip-lib/svm/utils/logger";
import { createTokenRegistryClient as sdkCreateTokenRegistryClient } from "../utils/client-factory";
import { TokenAdminRegistry } from "../../../ccip-lib/svm/bindings/accounts/tokenAdminRegistry";

const logger = createLogger("AdminClient");

export interface TokenRegistryTransaction {
  signature: string;
}

/**
 * Options for registering a token
 */
export interface RegisterTokenOptions {
  tokenMint: PublicKey;
  lookupTable: PublicKey;
  writableIndices: number[];
}

/**
 * Options for getting token admin registry data
 */
export interface GetTokenAdminRegistryOptions {
  tokenMint: PublicKey;
}

/**
 * Options for proposing a new administrator
 */
export interface ProposeAdministratorOptions {
  tokenMint: PublicKey;
  newAdmin: PublicKey;
}

/**
 * Options for accepting an admin role
 */
export interface AcceptAdminRoleOptions {
  tokenMint: PublicKey;
}

/**
 * Options for transferring an admin role
 */
export interface TransferAdminRoleOptions {
  tokenMint: PublicKey;
  newAdmin: PublicKey;
}

/**
 * Options for creating a token pool lookup table
 */
export interface CreateTokenPoolLookupTableOptions {
  tokenMint: PublicKey;
  poolProgramId: PublicKey;
  feeQuoterProgramId: PublicKey;
}

/**
 * Options for extending a token pool lookup table
 */
export interface ExtendTokenPoolLookupTableOptions {
  lookupTableAddress: PublicKey;
  newAddresses: PublicKey[];
}

export interface TokenRegistryClient {
  /**
   * Registers a token in the token admin registry
   *
   * @param options The token registration options
   * @returns The transaction signature
   */
  setPool(options: RegisterTokenOptions): Promise<TokenRegistryTransaction>;

  /**
   * Retrieves a token's registration data from the token admin registry
   * @param options The options for retrieving token admin registry
   * @returns Token admin registry account data
   */
  getTokenAdminRegistry(
    options: GetTokenAdminRegistryOptions
  ): Promise<TokenAdminRegistry | null>;

  /**
   * Proposes a new administrator for a token
   * @param options The options for proposing a new administrator
   * @returns The transaction signature
   */
  proposeAdministrator(
    options: ProposeAdministratorOptions
  ): Promise<TokenRegistryTransaction>;

  /**
   * Accepts the admin role for a token
   * @param options The options for accepting admin role
   * @returns The transaction signature
   */
  acceptAdminRole(
    options: AcceptAdminRoleOptions
  ): Promise<TokenRegistryTransaction>;

  /**
   * Transfers the admin role to a new administrator
   * @param options The options for transferring admin role
   * @returns The transaction signature
   */
  transferAdminRole(
    options: TransferAdminRoleOptions
  ): Promise<TokenRegistryTransaction>;

  /**
   * Creates an Address Lookup Table (ALT) for a token pool
   *
   * This method creates and extends an ALT with all the addresses required for CCIP token operations.
   * The ALT is essential for efficient cross-chain transactions.
   *
   * @param options The options for creating a token pool lookup table
   * @returns Promise resolving to the creation result with signature and ALT details
   */
  createTokenPoolLookupTable(
    options: CreateTokenPoolLookupTableOptions
  ): Promise<TokenRegistryTransaction>;

  /**
   * Extends an existing Address Lookup Table (ALT) with additional addresses
   *
   * This method adds new addresses to an existing ALT, allowing for more flexible
   * transaction composition. The caller must be the authority of the ALT to extend it.
   *
   * @param options The options for extending the lookup table
   * @returns Promise resolving to the transaction signature
   */
  extendTokenPoolLookupTable(
    options: ExtendTokenPoolLookupTableOptions
  ): Promise<TokenRegistryTransaction>;
}

export async function createTokenRegistryClient(
  routerProgramId: string,
  connection: Connection
): Promise<TokenRegistryClient> {
  // Use the SDK's createTokenRegistryClient with appropriate options
  const sdkClient = sdkCreateTokenRegistryClient(routerProgramId, {
    connection,
  });
  logger.info(`Created token registry client for program: ${routerProgramId}`);

  return {
    setPool: async (options: RegisterTokenOptions) => {
      const { tokenMint, lookupTable, writableIndices } = options;

      logger.info(
        `Registering token ${tokenMint.toString()} with lookup table ${lookupTable.toString()}`
      );
      logger.info(`Using lookup table: ${lookupTable.toString()}`);
      logger.info(`With writable indices: ${writableIndices.join(", ")}`);

      try {
        // Call setPool to register the token with the provided lookup table and writable indices
        const signature = await sdkClient.setPool({
          tokenMint,
          lookupTable,
          writableIndices,
        });

        logger.info(`Token registration successful. Transaction: ${signature}`);

        // setPool already confirms the transaction, so we don't need to wait for confirmation
        return { signature };
      } catch (error) {
        logger.error(
          `Failed to register token: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    getTokenAdminRegistry: async (options: GetTokenAdminRegistryOptions) => {
      const { tokenMint } = options;
      logger.info(`Fetching token registry data for ${tokenMint.toString()}`);

      try {
        // Use the SDK's getTokenAdminRegistry method to fetch and deserialize the account
        const tokenAdmin = await sdkClient.getTokenAdminRegistry(tokenMint);

        if (tokenAdmin) {
          logger.debug(
            `Token admin data retrieved for ${tokenMint.toString()}`
          );
        } else {
          logger.debug(`No token admin data found for ${tokenMint.toString()}`);
        }

        return tokenAdmin;
      } catch (error) {
        logger.error(
          `Failed to fetch token admin data: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    proposeAdministrator: async (options: ProposeAdministratorOptions) => {
      const { tokenMint, newAdmin } = options;
      logger.info(
        `Proposing administrator for token ${tokenMint.toString()}: ${newAdmin.toString()}`
      );
      try {
        // Use the SDK's proposeAdministrator method which matches our use case
        const tx = await sdkClient.proposeAdministrator({
          tokenMint,
          newAdmin,
        });

        logger.info(`Administrator proposed. Transaction: ${tx}`);

        // proposeAdministrator already confirms the transaction
        return { signature: tx };
      } catch (error) {
        logger.error(
          `Failed to propose administrator: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    acceptAdminRole: async (options: AcceptAdminRoleOptions) => {
      const { tokenMint } = options;

      logger.info(`Accepting admin role for token ${tokenMint.toString()}`);

      try {
        // Use the SDK's acceptAdminRole method
        const signature = await sdkClient.acceptAdminRole({
          tokenMint,
        });

        logger.info(`Admin role accepted. Transaction: ${signature}`);

        return { signature };
      } catch (error) {
        logger.error(
          `Failed to accept admin role: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    transferAdminRole: async (options: TransferAdminRoleOptions) => {
      const { tokenMint, newAdmin } = options;

      logger.info(
        `Transferring admin role for token ${tokenMint.toString()} to ${newAdmin.toString()}`
      );

      try {
        // Use the SDK's transferAdminRole method
        const signature = await sdkClient.transferAdminRole({
          tokenMint,
          newAdmin,
        });

        logger.info(`Admin role transfer initiated. Transaction: ${signature}`);

        return { signature };
      } catch (error) {
        logger.error(
          `Failed to transfer admin role: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    },

    createTokenPoolLookupTable: async (
      options: CreateTokenPoolLookupTableOptions
    ) => {
      const { tokenMint, poolProgramId, feeQuoterProgramId } = options;

      logger.info(
        `Creating token pool lookup table for mint: ${tokenMint.toString()}`
      );
      logger.info(`Pool program ID: ${poolProgramId.toString()}`);
      logger.info(`Fee quoter program ID: ${feeQuoterProgramId.toString()}`);
      logger.info(`Token program ID: Auto-detected from on-chain data`);

      try {
        // Call the underlying client method
        const result = await sdkClient.createTokenPoolLookupTable({
          tokenMint,
          poolProgramId,
          feeQuoterProgramId,
        });

        logger.info(`Token pool lookup table created successfully!`);
        logger.info(`ALT Address: ${result.lookupTableAddress.toString()}`);
        logger.info(`Transaction: ${result.signature}`);
        logger.info(`Total addresses in ALT: ${result.addresses.length}`);

        return { signature: result.signature };
      } catch (error) {
        logger.error("Failed to create token pool lookup table:", error);
        throw error;
      }
    },

    extendTokenPoolLookupTable: async (
      options: ExtendTokenPoolLookupTableOptions
    ) => {
      const { lookupTableAddress, newAddresses } = options;

      logger.info(
        `Extending lookup table ${lookupTableAddress.toString()} with ${
          newAddresses.length
        } new addresses`
      );
      logger.debug("New addresses to add:");
      newAddresses.forEach((addr, index) => {
        logger.trace(`  [${index}]: ${addr.toString()}`);
      });

      try {
        // Call the underlying client method
        const result = await sdkClient.extendTokenPoolLookupTable({
          lookupTableAddress,
          newAddresses,
        });

        logger.info(`Lookup table extended successfully!`);
        logger.info(`ALT Address: ${result.lookupTableAddress.toString()}`);
        logger.info(`Transaction: ${result.signature}`);
        logger.info(`Added ${result.newAddresses.length} new addresses`);
        logger.info(`Total addresses in ALT: ${result.totalAddresses}`);

        return { signature: result.signature };
      } catch (error) {
        logger.error("Failed to extend lookup table:", error);
        throw error;
      }
    },
  };
}
