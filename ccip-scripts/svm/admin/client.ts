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
  destinationChain: number;
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
      const { tokenMint, lookupTable, writableIndices, destinationChain } =
        options;

      logger.info(
        `Registering token ${tokenMint.toString()} for destination chain ${destinationChain}`
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
  };
}
