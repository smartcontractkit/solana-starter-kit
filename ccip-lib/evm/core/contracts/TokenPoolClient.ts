import { ethers } from "ethers";
import { BaseContract } from "./BaseContract";
import { CCIPEVMContext } from "../models";
import { BurnMintTokenPool } from "../../types/contracts/BurnMintTokenPool";
import { BurnMintTokenPool__factory } from "../../types/contracts/factories/BurnMintTokenPool__factory";

/**
 * Client for interacting with BurnMintTokenPool contracts
 */
export class TokenPoolClient extends BaseContract {
  private readonly poolAddress: string;

  /**
   * Creates a new TokenPool client
   * 
   * @param context Client context with provider, config, and logger
   * @param poolAddress Address of the token pool contract
   */
  constructor(context: CCIPEVMContext, poolAddress: string) {
    super(context, "ccip-token-pool-client");
    this.poolAddress = poolAddress;
    
    this._logger.debug("Initialized TokenPoolClient", {
      poolAddress: this.poolAddress,
    });
  }

  /**
   * Creates a read-only TokenPool contract instance
   * @returns TokenPool contract with read-only capabilities
   */
  getReadContract(): BurnMintTokenPool {
    return BurnMintTokenPool__factory.connect(
      this.poolAddress,
      this.context.provider.provider
    );
  }

  /**
   * Creates a TokenPool contract instance with signing capabilities
   * @throws Error if the provider doesn't have signing capabilities
   * @returns TokenPool contract with signing capabilities
   */
  getWriteContract(): BurnMintTokenPool {
    const signer = this.getSigner();
    return BurnMintTokenPool__factory.connect(this.poolAddress, signer);
  }

  /**
   * Checks if a destination chain is supported by this token pool
   * @param chainSelector Destination chain selector to check
   * @returns True if the chain is supported
   */
  async isSupportedChain(chainSelector: bigint): Promise<boolean> {
    this._logger.debug(`Checking if chain ${chainSelector} is supported by token pool`);
    try {
      const tokenPool = this.getReadContract();
      return await tokenPool.isSupportedChain(chainSelector);
    } catch (error) {
      this._logger.error(`Error checking chain support for token pool: ${error}`);
      throw error;
    }
  }

  /**
   * Gets the token address associated with this pool
   * @returns Token address
   */
  async getToken(): Promise<string> {
    try {
      const tokenPool = this.getReadContract();
      return await tokenPool.getToken();
    } catch (error) {
      this._logger.error(`Error getting token address: ${error}`);
      throw error;
    }
  }
} 