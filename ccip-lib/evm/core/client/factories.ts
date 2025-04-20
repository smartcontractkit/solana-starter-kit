import { CCIPEVMContext } from "../models";
import { BurnMintERC677HelperClient, ERC20Client, RouterClient, TokenAdminRegistryClient, TokenPoolClient } from "../contracts";

/**
 * Creates a Router client
 * 
 * @param context Client context with provider and config
 * @returns Router client instance
 */
export function createRouterClient(
  context: CCIPEVMContext
): RouterClient {
  return new RouterClient(context);
}

/**
 * Creates a TokenAdminRegistry client
 * 
 * @param context Client context with provider and config
 * @returns TokenAdminRegistry client instance
 */
export function createTokenAdminRegistryClient(
  context: CCIPEVMContext
): TokenAdminRegistryClient {
  return new TokenAdminRegistryClient(context);
}

/**
 * Creates a TokenPool client
 * 
 * @param context Client context with provider and config
 * @param poolAddress Pool contract address
 * @returns TokenPool client instance
 */
export function createTokenPoolClient(
  context: CCIPEVMContext,
  poolAddress: string
): TokenPoolClient {
  return new TokenPoolClient(context, poolAddress);
}

/**
 * Creates an ERC20 client
 * 
 * @param context Client context with provider and config
 * @param tokenAddress Token contract address
 * @returns ERC20 client instance
 */
export function createERC20Client(
  context: CCIPEVMContext,
  tokenAddress: string
): ERC20Client {
  return new ERC20Client(context, tokenAddress);
}

/**
 * Creates a BurnMintERC677Helper client
 * 
 * @param context Client context with provider and config
 * @param tokenAddress Token contract address
 * @returns BurnMintERC677Helper client instance
 */
export function createBurnMintERC677HelperClient(
  context: CCIPEVMContext,
  tokenAddress: string
): BurnMintERC677HelperClient {
  return new BurnMintERC677HelperClient(context, tokenAddress);
} 