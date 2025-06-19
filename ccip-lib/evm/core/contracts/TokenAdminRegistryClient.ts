import { ethers } from "ethers";
import { BaseContract } from "./BaseContract";
import { CCIPEVMContext } from "../models";
import { TokenAdminRegistry } from "../../types/contracts/TokenAdminRegistry";
import { TokenAdminRegistry__factory } from "../../types/contracts/factories/TokenAdminRegistry__factory";

/**
 * Client for interacting with the TokenAdminRegistry contract
 */
export class TokenAdminRegistryClient extends BaseContract {
  private readonly tokenAdminRegistryAddress: string;

  /**
   * Creates a new TokenAdminRegistry client
   * 
   * @param context Client context with provider, config, and logger
   */
  constructor(context: CCIPEVMContext) {
    super(context, "ccip-token-admin-registry-client");
    this.tokenAdminRegistryAddress = this.context.config.tokenAdminRegistryAddress;
    
    this._logger.debug("Initialized TokenAdminRegistryClient", {
      tokenAdminRegistryAddress: this.tokenAdminRegistryAddress,
    });
  }

  /**
   * Creates a read-only TokenAdminRegistry contract instance
   * @returns TokenAdminRegistry contract with read-only capabilities
   */
  getReadContract(): TokenAdminRegistry {
    return TokenAdminRegistry__factory.connect(
      this.tokenAdminRegistryAddress,
      this.context.provider.provider
    );
  }

  /**
   * Creates a TokenAdminRegistry contract instance with signing capabilities
   * @throws Error if the provider doesn't have signing capabilities
   * @returns TokenAdminRegistry contract with signing capabilities
   */
  getWriteContract(): TokenAdminRegistry {
    const signer = this.getSigner();
    return TokenAdminRegistry__factory.connect(
      this.tokenAdminRegistryAddress, 
      signer
    );
  }

  /**
   * Gets the token pool address for a token
   * @param tokenAddress Token address to get the pool for
   * @returns Pool address for the token
   */
  async getPool(tokenAddress: string): Promise<string> {
    this._logger.debug(`Getting pool for token ${tokenAddress}`);
    try {
      const tokenAdminRegistry = this.getReadContract();
      return await tokenAdminRegistry.getPool(tokenAddress);
    } catch (error) {
      this._logger.error(`Error getting token pool: ${error}`);
      throw error;
    }
  }

  /**
   * Checks if a token is supported with a pool
   * @param tokenAddress Token address to check
   * @returns True if the token has an associated pool
   */
  async isTokenSupported(tokenAddress: string): Promise<boolean> {
    try {
      const pool = await this.getPool(tokenAddress);
      return pool !== ethers.ZeroAddress;
    } catch (error) {
      this._logger.error(`Error checking token support: ${error}`);
      return false;
    }
  }
} 