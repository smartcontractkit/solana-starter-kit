import { ethers } from "ethers";
import { BaseContract } from "./BaseContract";
import { CCIPEVMContext } from "../models";
import { ERC20 } from "../../types/contracts/ERC20";
import { ERC20__factory } from "../../types/contracts/factories/ERC20__factory";

/**
 * Client for interacting with ERC20 token contracts
 */
export class ERC20Client extends BaseContract {
  private readonly tokenAddress: string;

  /**
   * Creates a new ERC20 client
   * 
   * @param context Client context with provider, config, and logger
   * @param tokenAddress Address of the ERC20 token contract
   */
  constructor(context: CCIPEVMContext, tokenAddress: string) {
    super(context, "ccip-erc20-client");
    this.tokenAddress = tokenAddress;
    
    this._logger.debug("Initialized ERC20Client", {
      tokenAddress: this.tokenAddress,
    });
  }

  /**
   * Creates a read-only ERC20 contract instance
   * @returns ERC20 contract with read-only capabilities
   */
  getReadContract(): ERC20 {
    return ERC20__factory.connect(
      this.tokenAddress,
      this.context.provider.provider
    );
  }

  /**
   * Creates an ERC20 contract instance with signing capabilities
   * @throws Error if the provider doesn't have signing capabilities
   * @returns ERC20 contract with signing capabilities
   */
  getWriteContract(): ERC20 {
    const signer = this.getSigner();
    return ERC20__factory.connect(this.tokenAddress, signer);
  }

  /**
   * Gets the token symbol
   * @returns Token symbol
   */
  async getSymbol(): Promise<string> {
    try {
      const contract = this.getReadContract();
      return await contract.symbol();
    } catch (error) {
      this._logger.error(`Error getting token symbol: ${error}`);
      throw error;
    }
  }

  /**
   * Gets the token decimals
   * @returns Token decimals
   */
  async getDecimals(): Promise<number> {
    try {
      const contract = this.getReadContract();
      const decimals = await contract.decimals();
      return Number(decimals);
    } catch (error) {
      this._logger.error(`Error getting token decimals: ${error}`);
      throw error;
    }
  }

  /**
   * Gets token balance for an address
   * @param address Address to check balance for
   * @returns Token balance
   */
  async getBalance(address: string): Promise<bigint> {
    try {
      const contract = this.getReadContract();
      return await contract.balanceOf(address);
    } catch (error) {
      this._logger.error(`Error getting token balance: ${error}`);
      throw error;
    }
  }

  /**
   * Gets token allowance
   * @param ownerAddress Token owner address
   * @param spenderAddress Token spender address
   * @returns Allowance amount
   */
  async getAllowance(ownerAddress: string, spenderAddress: string): Promise<bigint> {
    try {
      const contract = this.getReadContract();
      return await contract.allowance(ownerAddress, spenderAddress);
    } catch (error) {
      this._logger.error(`Error getting token allowance: ${error}`);
      throw error;
    }
  }

  /**
   * Approves tokens for a spender
   * @param spenderAddress Address to approve
   * @param amount Amount to approve
   * @returns Transaction receipt
   */
  async approve(spenderAddress: string, amount: bigint): Promise<ethers.TransactionReceipt> {
    this._logger.info(`Approving ${amount} tokens for ${spenderAddress}`);
    
    try {
      const contract = this.getWriteContract();
      const tx = await contract.approve(spenderAddress, amount);
      
      this._logger.debug(`Approval transaction sent: ${tx.hash}`);
      
      // Wait for transaction to be mined with proper confirmations
      return await this.waitForTransaction(tx);
    } catch (error) {
      this._logger.error(`Error approving tokens: ${error}`);
      throw error;
    }
  }

  /**
   * Formats token amount with proper decimals
   * @param amount Amount to format
   * @returns Formatted amount string
   */
  async formatAmount(amount: bigint): Promise<string> {
    try {
      const decimals = await this.getDecimals();
      return ethers.formatUnits(amount, decimals);
    } catch (error) {
      this._logger.error(`Error formatting token amount: ${error}`);
      throw error;
    }
  }
} 