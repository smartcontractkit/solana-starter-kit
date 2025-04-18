import { ethers } from "ethers";
import { BaseContract } from "./BaseContract";
import { CCIPEVMContext } from "../models";
import { BurnMintERC677Helper } from "../../types/contracts/BurnMintERC677Helper";
import { BurnMintERC677Helper__factory } from "../../types/contracts/factories/BurnMintERC677Helper__factory";
import { BatchOptions, BatchResult, executeBatch } from "../../utils/transactions";

/**
 * Options for multi-drip operations
 */
export interface MultiDripOptions extends BatchOptions {
  // Additional options specific to drip operations can be added here
}

/**
 * Result of multi-drip operations
 */
export interface MultiDripResult extends BatchResult {
  /** Initial token balance */
  initialBalance: bigint;
  
  /** Final token balance */
  finalBalance: bigint;
  
  /** Tokens gained during the operation */
  tokensGained: bigint;
}

/**
 * Client for interacting with BurnMintERC677Helper contracts
 * These are special ERC677 tokens with minting and burning roles,
 * typically used for testing and token distribution
 */
export class BurnMintERC677HelperClient extends BaseContract {
  private readonly tokenAddress: string;

  /**
   * Creates a new BurnMintERC677Helper client
   * 
   * @param context Client context with provider, config, and logger
   * @param tokenAddress Address of the BurnMintERC677Helper token contract
   */
  constructor(context: CCIPEVMContext, tokenAddress: string) {
    super(context, "ccip-burnmint-erc677-helper-client");
    this.tokenAddress = tokenAddress;
    
    this._logger.debug("Initialized BurnMintERC677HelperClient", {
      tokenAddress: this.tokenAddress,
    });
  }

  /**
   * Creates a read-only BurnMintERC677Helper contract instance
   * @returns BurnMintERC677Helper contract with read-only capabilities
   */
  getReadContract(): BurnMintERC677Helper {
    return BurnMintERC677Helper__factory.connect(
      this.tokenAddress,
      this.context.provider.provider
    );
  }

  /**
   * Creates a BurnMintERC677Helper contract instance with signing capabilities
   * @throws Error if the provider doesn't have signing capabilities
   * @returns BurnMintERC677Helper contract with signing capabilities
   */
  getWriteContract(): BurnMintERC677Helper {
    const signer = this.getSigner();
    return BurnMintERC677Helper__factory.connect(this.tokenAddress, signer);
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
   * Transfers tokens to another address
   * @param toAddress Destination address
   * @param amount Amount to transfer
   * @returns Transaction receipt
   */
  async transfer(toAddress: string, amount: bigint): Promise<ethers.TransactionReceipt> {
    this._logger.info(`Transferring ${amount} tokens to ${toAddress}`);
    
    try {
      const contract = this.getWriteContract();
      const tx = await contract.transfer(toAddress, amount);
      
      this._logger.debug(`Transfer transaction sent: ${tx.hash}`);
      
      // Wait for transaction to be mined with proper confirmations
      return await this.waitForTransaction(tx);
    } catch (error) {
      this._logger.error(`Error transferring tokens: ${error}`);
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

  /**
   * Calculates and formats the gain between two token amounts
   * @param initialAmount Initial token amount
   * @param finalAmount Final token amount
   * @returns Formatted gain amount string
   */
  async formatGain(initialAmount: bigint, finalAmount: bigint): Promise<string> {
    const gain = finalAmount - initialAmount;
    return await this.formatAmount(gain);
  }

  /**
   * Drips tokens to a specified address
   * Uses the special drip function provided by the BurnMintERC677Helper contract
   * 
   * @param toAddress Address to drip tokens to
   * @returns Transaction receipt
   */
  async drip(toAddress: string): Promise<ethers.TransactionReceipt> {
    this._logger.info(`Dripping tokens to ${toAddress}`);
    
    try {
      const contract = this.getWriteContract();
      const tx = await contract.drip(toAddress);
      
      this._logger.debug(`Drip transaction sent: ${tx.hash}`);
      
      // Wait for transaction to be mined with proper confirmations
      return await this.waitForTransaction(tx);
    } catch (error) {
      this._logger.error(`Error dripping tokens: ${error}`);
      throw error;
    }
  }

  /**
   * Drips tokens multiple times to a specified address
   * 
   * @param toAddress Address to drip tokens to
   * @param count Number of drip operations to perform
   * @param options Optional parameters for the multi-drip operation
   * @returns A summary of the multi-drip operation results
   */
  async multiDrip(
    toAddress: string,
    count: number,
    options: MultiDripOptions = {}
  ): Promise<MultiDripResult> {
    // Get token details for logging
    const tokenSymbol = await this.getSymbol();
    
    // Get initial balance
    const initialBalance = await this.getBalance(toAddress);
    const formattedInitialBalance = await this.formatAmount(initialBalance);
    this._logger.info(`Initial ${tokenSymbol} balance: ${formattedInitialBalance}`);
    
    this._logger.info(`Starting multi-drip operation: ${count} drips to ${toAddress}`);
    
    // Execute batch drip operations using the utility function
    const batchResult = await executeBatch(
      this.drip.bind(this), // Bind 'this' to the drip method
      count,
      [toAddress] as [string], // Arguments for drip function as tuple
      this._logger,
      options
    );
    
    // Get final balance and calculate gain
    const finalBalance = await this.getBalance(toAddress);
    const tokensGained = finalBalance - initialBalance;
    
    // Format amounts for logging
    const formattedFinalBalance = await this.formatAmount(finalBalance);
    const formattedGain = await this.formatAmount(tokensGained);
    
    // Log final results
    this._logger.info(`Final ${tokenSymbol} balance: ${formattedFinalBalance}`);
    this._logger.info(`Total ${tokenSymbol} gained: ${formattedGain}`);
    
    // Return the combined result
    return {
      ...batchResult,
      initialBalance,
      finalBalance,
      tokensGained
    };
  }

  /**
   * Mints tokens to a specified address
   * Requires the caller to have minter role
   * 
   * @param toAddress Address to mint tokens to
   * @param amount Amount of tokens to mint
   * @returns Transaction receipt
   */
  async mint(toAddress: string, amount: bigint): Promise<ethers.TransactionReceipt> {
    this._logger.info(`Minting ${amount} tokens to ${toAddress}`);
    
    try {
      const contract = this.getWriteContract();
      const tx = await contract.mint(toAddress, amount);
      
      this._logger.debug(`Mint transaction sent: ${tx.hash}`);
      
      // Wait for transaction to be mined with proper confirmations
      return await this.waitForTransaction(tx);
    } catch (error) {
      this._logger.error(`Error minting tokens: ${error}`);
      throw error;
    }
  }

  /**
   * Burns tokens from the caller's balance
   * Requires the caller to have burner role
   * 
   * @param amount Amount of tokens to burn
   * @returns Transaction receipt
   */
  async burn(amount: bigint): Promise<ethers.TransactionReceipt> {
    this._logger.info(`Burning ${amount} tokens`);
    
    try {
      const contract = this.getWriteContract();
      const tx = await contract.burn(amount);
      
      this._logger.debug(`Burn transaction sent: ${tx.hash}`);
      
      // Wait for transaction to be mined with proper confirmations
      return await this.waitForTransaction(tx);
    } catch (error) {
      this._logger.error(`Error burning tokens: ${error}`);
      throw error;
    }
  }

  /**
   * Burns tokens from a specified address
   * Requires approval from the address and caller to have burner role
   * 
   * @param fromAddress Address to burn tokens from
   * @param amount Amount of tokens to burn
   * @returns Transaction receipt
   */
  async burnFrom(fromAddress: string, amount: bigint): Promise<ethers.TransactionReceipt> {
    this._logger.info(`Burning ${amount} tokens from ${fromAddress}`);
    
    try {
      const contract = this.getWriteContract();
      const tx = await contract.burnFrom(fromAddress, amount);
      
      this._logger.debug(`BurnFrom transaction sent: ${tx.hash}`);
      
      // Wait for transaction to be mined with proper confirmations
      return await this.waitForTransaction(tx);
    } catch (error) {
      this._logger.error(`Error burning tokens from address: ${error}`);
      throw error;
    }
  }

  /**
   * Grants minter role to an address
   * Only the owner can call this function
   * 
   * @param minterAddress Address to grant minter role to
   * @returns Transaction receipt
   */
  async grantMintRole(minterAddress: string): Promise<ethers.TransactionReceipt> {
    this._logger.info(`Granting minter role to ${minterAddress}`);
    
    try {
      const contract = this.getWriteContract();
      const tx = await contract.grantMintRole(minterAddress);
      
      this._logger.debug(`Grant minter role transaction sent: ${tx.hash}`);
      
      // Wait for transaction to be mined with proper confirmations
      return await this.waitForTransaction(tx);
    } catch (error) {
      this._logger.error(`Error granting minter role: ${error}`);
      throw error;
    }
  }

  /**
   * Grants burner role to an address
   * Only the owner can call this function
   * 
   * @param burnerAddress Address to grant burner role to
   * @returns Transaction receipt
   */
  async grantBurnRole(burnerAddress: string): Promise<ethers.TransactionReceipt> {
    this._logger.info(`Granting burner role to ${burnerAddress}`);
    
    try {
      const contract = this.getWriteContract();
      const tx = await contract.grantBurnRole(burnerAddress);
      
      this._logger.debug(`Grant burner role transaction sent: ${tx.hash}`);
      
      // Wait for transaction to be mined with proper confirmations
      return await this.waitForTransaction(tx);
    } catch (error) {
      this._logger.error(`Error granting burner role: ${error}`);
      throw error;
    }
  }

  /**
   * Gets a list of all addresses with minter role
   * 
   * @returns Array of minter addresses
   */
  async getMinters(): Promise<string[]> {
    try {
      const contract = this.getReadContract();
      return await contract.getMinters();
    } catch (error) {
      this._logger.error(`Error getting minters: ${error}`);
      throw error;
    }
  }

  /**
   * Gets a list of all addresses with burner role
   * 
   * @returns Array of burner addresses
   */
  async getBurners(): Promise<string[]> {
    try {
      const contract = this.getReadContract();
      return await contract.getBurners();
    } catch (error) {
      this._logger.error(`Error getting burners: ${error}`);
      throw error;
    }
  }

  /**
   * Checks if an address has minter role
   * 
   * @param address Address to check
   * @returns Whether the address has minter role
   */
  async isMinter(address: string): Promise<boolean> {
    try {
      const contract = this.getReadContract();
      return await contract.isMinter(address);
    } catch (error) {
      this._logger.error(`Error checking if address is minter: ${error}`);
      throw error;
    }
  }

  /**
   * Checks if an address has burner role
   * 
   * @param address Address to check
   * @returns Whether the address has burner role
   */
  async isBurner(address: string): Promise<boolean> {
    try {
      const contract = this.getReadContract();
      return await contract.isBurner(address);
    } catch (error) {
      this._logger.error(`Error checking if address is burner: ${error}`);
      throw error;
    }
  }
} 