import { PublicKey } from "@solana/web3.js";
import { uint64ToLE } from "./common";
import { Connection } from "@solana/web3.js";
import { tokenAdminRegistry } from "../../bindings/accounts";

/**
 * CCIP Router PDA utilities
 */

/**
 * Finds the Config PDA for a program
 * @param programId Router program ID
 * @returns [PDA, bump]
 */
export function findConfigPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
}

/**
 * Finds the Fee Billing Signer PDA for a program
 * @param programId Router program ID
 * @returns [PDA, bump]
 */
export function findFeeBillingSignerPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("fee_billing_signer")], programId);
}

/**
 * Finds the Token Admin Registry PDA for a mint
 * @param mint Token mint
 * @param programId Router program ID
 * @returns [PDA, bump]
 */
export function findTokenAdminRegistryPDA(mint: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("token_admin_registry"), mint.toBuffer()],
    programId
  );
}

/**
 * Finds the Destination Chain State PDA for a chain selector
 * @param chainSelector Chain selector
 * @param programId Router program ID
 * @returns [PDA, bump]
 */
export function findDestChainStatePDA(chainSelector: bigint, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dest_chain_state"), uint64ToLE(chainSelector)],
    programId
  );
}

/**
 * Finds the Nonce PDA for a chain selector and authority
 * @param chainSelector Chain selector
 * @param authority User authority
 * @param programId Router program ID
 * @returns [PDA, bump]
 */
export function findNoncePDA(chainSelector: bigint, authority: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("nonce"), uint64ToLE(chainSelector), authority.toBuffer()],
    programId
  );
}

/**
 * Finds the Approved Sender PDA for a chain selector and source sender
 * @param chainSelector Chain selector
 * @param sourceSender Source chain sender address
 * @param receiverProgram Receiver program ID
 * @returns [PDA, bump]
 */
export function findApprovedSenderPDA(chainSelector: bigint, sourceSender: Buffer, receiverProgram: PublicKey): [PublicKey, number] {
  const lenPrefix = Buffer.from([sourceSender.length]);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("approved_ccip_sender"), uint64ToLE(chainSelector), lenPrefix, sourceSender],
    receiverProgram
  );
}

/**
 * Finds the Allowed Offramp PDA for a chain selector and offramp
 * @param chainSelector Chain selector
 * @param offramp Offramp program ID
 * @param programId Router program ID
 * @returns [PDA, bump]
 */
export function findAllowedOfframpPDA(chainSelector: bigint, offramp: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("allowed_offramp"), uint64ToLE(chainSelector), offramp.toBuffer()],
    programId
  );
}

/**
 * Finds the Token Pool Chain Config PDA for a chain selector and token mint
 * @param chainSelector Chain selector
 * @param tokenMint Token mint
 * @param programId Pool program ID
 * @returns [PDA, bump]
 */
export function findTokenPoolChainConfigPDA(
  chainSelector: bigint,
  tokenMint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("ccip_tokenpool_chainconfig"), uint64ToLE(chainSelector), tokenMint.toBuffer()],
    programId
  );
}

/**
 * Finds the External Token Pools Signer PDA for a program
 * @param programId Router program ID
 * @returns [PDA, bump]
 */
export function findExternalTokenPoolsSignerPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("external_token_pools_signer")], programId);
}

/**
 * Dynamically finds the correct token pool signer PDA for a specific token by retrieving 
 * its admin registry and pool program from the lookup table.
 * 
 * This function performs on-chain lookups to determine the exact PDA used for token transfers
 * in the CCIP protocol, which requires both the external_token_pools_signer seed and the 
 * pool program ID from the token's lookup table.
 * 
 * @param mint Token mint public key
 * @param routerProgramId CCIP Router program ID
 * @param connection Solana connection
 * @returns Promise with [PDA, bump]
 */
export async function findDynamicTokenPoolsSignerPDA(
  mint: PublicKey, 
  routerProgramId: PublicKey,
  connection: Connection
): Promise<[PublicKey, number]> {
  // First find the token admin registry PDA
  const [tokenAdminRegistryPDA] = findTokenAdminRegistryPDA(mint, routerProgramId);
  
  // Fetch the token admin registry account
  const tokenAdminRegistryAccount = await connection.getAccountInfo(tokenAdminRegistryPDA);
  if (!tokenAdminRegistryAccount) {
    throw new Error(`Token admin registry not found for mint: ${mint.toString()}`);
  }
  
  // Decode the token admin registry to get the lookup table
  const tokenRegistry = tokenAdminRegistry.decode(tokenAdminRegistryAccount.data);
  const lookupTableAddress = tokenRegistry.lookupTable;
  
  // Fetch the lookup table
  const { value: lookupTableAccount } = await connection.getAddressLookupTable(lookupTableAddress);
  if (!lookupTableAccount) {
    throw new Error(`Lookup table not found: ${lookupTableAddress.toString()}`);
  }
  
  // Get the addresses from the lookup table
  const lookupTableAddresses = lookupTableAccount.state.addresses;
  
  // The pool program is at index 2 in the lookup table
  if (lookupTableAddresses.length <= 2) {
    throw new Error("Lookup table doesn't have enough entries to determine pool program");
  }
  
  // Extract the pool program from the lookup table (index 2)
  const poolProgram = lookupTableAddresses[2];
  
  // Now create the correct PDA using both the external_token_pools_signer seed and the pool program
  return PublicKey.findProgramAddressSync(
    [Buffer.from("external_token_pools_signer"), poolProgram.toBuffer()],
    routerProgramId
  );
}

/**
 * Finds the External Execution Config PDA for a program
 * @param programId Router program ID
 * @returns [PDA, bump]
 */
export function findExternalExecutionConfigPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("external_execution_config")], programId);
}

/**
 * Finds the correct token pool signer PDA using the CCIPAccountReader
 * 
 * This version uses the CCIPAccountReader which already has methods to retrieve 
 * token admin registry accounts, making the process more reliable and consistent
 * with the rest of the SDK.
 * 
 * @param mint Token mint public key
 * @param routerProgramId CCIP Router program ID
 * @param accountReader CCIPAccountReader instance
 * @param connection Solana connection
 * @returns Promise with [PDA, bump]
 */
export async function findTokenPoolsSignerWithAccountReader(
  mint: PublicKey,
  routerProgramId: PublicKey,
  accountReader: import("../../core/client/accounts").CCIPAccountReader,
  connection: Connection
): Promise<[PublicKey, number]> {
  // Use the account reader to get the token admin registry
  const tokenRegistry = await accountReader.getTokenAdminRegistry(mint);
  
  // Fetch the lookup table
  const { value: lookupTableAccount } = await connection.getAddressLookupTable(tokenRegistry.lookupTable);
  if (!lookupTableAccount) {
    throw new Error(`Lookup table not found: ${tokenRegistry.lookupTable.toString()}`);
  }
  
  // Get the addresses from the lookup table
  const lookupTableAddresses = lookupTableAccount.state.addresses;
  
  // The pool program is at index 2 in the lookup table
  if (lookupTableAddresses.length <= 2) {
    throw new Error("Lookup table doesn't have enough entries to determine pool program");
  }
  
  // Extract the pool program from the lookup table (index 2)
  const poolProgram = lookupTableAddresses[2];
  
  // Now create the correct PDA using both the external_token_pools_signer seed and the pool program
  return PublicKey.findProgramAddressSync(
    [Buffer.from("external_token_pools_signer"), poolProgram.toBuffer()],
    routerProgramId
  );
} 