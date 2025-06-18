import { ethers } from "ethers";
import { BaseContract } from "./BaseContract";
import { CCIPEVMContext } from "../models";
import { Router, Client } from "../../types/contracts/Router";
import { Router__factory } from "../../types/contracts/factories/Router__factory";

/**
 * Helper function to safely serialize BigInt values for logging
 */
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (_, value) => 
    typeof value === 'bigint' ? value.toString() : value
  );
}

/**
 * Client for interacting with the CCIP Router contract
 */
export class RouterClient extends BaseContract {
  private readonly routerAddress: string;

  /**
   * Creates a new Router client
   * 
   * @param context Client context with provider, config, and logger
   */
  constructor(context: CCIPEVMContext) {
    super(context, "ccip-router-client");
    this.routerAddress = this.context.config.routerAddress;
    
    this._logger.debug("Initialized RouterClient", {
      routerAddress: this.routerAddress,
    });
  }

  /**
   * Creates a read-only Router contract instance
   * @returns Router contract with read-only capabilities
   */
  getReadContract(): Router {
    return Router__factory.connect(
      this.routerAddress,
      this.context.provider.provider
    );
  }

  /**
   * Creates a Router contract instance with signing capabilities
   * @throws Error if the provider doesn't have signing capabilities
   * @returns Router contract with signing capabilities
   */
  getWriteContract(): Router {
    const signer = this.getSigner();
    return Router__factory.connect(this.routerAddress, signer);
  }

  /**
   * Checks if a destination chain is supported by the router
   * (Read-only operation, works with either provider type)
   *
   * @param chainSelector Destination chain selector
   * @returns True if the chain is supported
   */
  async isChainSupported(chainSelector: bigint): Promise<boolean> {
    this._logger.debug(`Checking if chain ${chainSelector} is supported by router ${this.routerAddress}`);
    try {
      // Check network connection first
      try {
        const network = await this.context.provider.provider.getNetwork();
        this._logger.debug(`Connected to network: ${safeStringify({
          chainId: network.chainId,
          name: network.name
        })}`);
      } catch (netError) {
        this._logger.error(`Failed to connect to network: ${netError}`);
      }
      
      // Debug the contract call
      this._logger.debug(`Making contract call to isChainSupported with selector: ${chainSelector}`);
      
      // Get router contract
      const router = this.getReadContract();
      
      try {
        // Check if the function exists on the contract
        if (typeof router.isChainSupported !== 'function') {
          this._logger.error('isChainSupported function does not exist on the router contract!');
          return false;
        }
        
        // Make the call and capture any errors
        const result = await router.isChainSupported(chainSelector);
        this._logger.debug(`isChainSupported call succeeded: ${result}`);
        return result;
      } catch (callError) {
        this._logger.error(`Contract call error details: ${safeStringify(callError)}`);
        throw callError;
      }
    } catch (error) {
      this._logger.error(`Error checking chain support: ${error}`);
      throw error;
    }
  }

  /**
   * Calculates the fee for a CCIP message
   * 
   * @param destChainSelector Destination chain selector
   * @param message CCIP message
   * @returns Fee amount
   */
  async getFee(
    destChainSelector: bigint,
    message: Client.EVM2AnyMessageStruct
  ): Promise<bigint> {
    this._logger.debug("Calculating CCIP fee", { 
      destChainSelector: destChainSelector.toString(), 
      message: safeStringify(message) 
    });

    try {
      // Get read-only router contract
      const router = this.getReadContract();

      // Call the router to get the fee
      const fee = await router.getFee(destChainSelector, message);

      this._logger.debug(`Fee calculation successful: ${fee.toString()}`);

      return fee;
    } catch (error) {
      this._logger.error(`Error calculating fee: ${error}`);
      throw error;
    }
  }

  /**
   * Sends a CCIP message
   * (Write operation, requires a provider with signing capabilities)
   * 
   * @param destChainSelector Destination chain selector
   * @param message CCIP message to send
   * @param options Transaction options (e.g., value for native token fees)
   * @returns Transaction receipt
   */
  async ccipSend(
    destChainSelector: bigint,
    message: Client.EVM2AnyMessageStruct,
    options: { value?: bigint } = {}
  ): Promise<ethers.TransactionReceipt> {
    this._logger.info("Sending CCIP message...");
    try {
      const router = this.getWriteContract();
      const tx = await router.ccipSend(destChainSelector, message, options);

      this._logger.info(`Transaction sent: ${tx.hash}`);

      // Wait for transaction to be mined with proper confirmations
      this._logger.debug("Waiting for transaction confirmation...");
      return await this.waitForTransaction(tx);
    } catch (error) {
      this._logger.error(`Error sending CCIP message: ${error}`);
      throw error;
    }
  }
} 