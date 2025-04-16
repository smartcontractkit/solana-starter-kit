import { PublicKey } from "@solana/web3.js";
import { uint64ToLE } from "./common";

/**
 * Fee Quoter PDA utilities
 */

/**
 * Finds the Fee Quoter Config PDA
 * @param feeQuoter Fee Quoter program ID
 * @returns [PDA, bump]
 */
export function findFqConfigPDA(feeQuoter: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], feeQuoter);
}

/**
 * Finds the Fee Quoter Dest Chain PDA for a chain selector
 * @param chainSelector Chain selector
 * @param feeQuoter Fee Quoter program ID
 * @returns [PDA, bump]
 */
export function findFqDestChainPDA(chainSelector: bigint, feeQuoter: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dest_chain"), uint64ToLE(chainSelector)],
    feeQuoter
  );
}

/**
 * Finds the Fee Quoter Billing Token Config PDA for a mint
 * @param mint Token mint
 * @param feeQuoter Fee Quoter program ID
 * @returns [PDA, bump]
 */
export function findFqBillingTokenConfigPDA(mint: PublicKey, feeQuoter: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("fee_billing_token_config"), mint.toBuffer()],
    feeQuoter
  );
}

/**
 * Finds the Fee Quoter Per Chain Per Token Config PDA for a chain selector and mint
 * @param chainSelector Chain selector
 * @param mint Token mint
 * @param feeQuoter Fee Quoter program ID
 * @returns [PDA, bump]
 */
export function findFqPerChainPerTokenConfigPDA(chainSelector: bigint, mint: PublicKey, feeQuoter: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("per_chain_per_token_config"), uint64ToLE(chainSelector), mint.toBuffer()],
    feeQuoter
  );
}

/**
 * Finds the Fee Quoter Allowed Price Updater PDA for a price updater
 * @param priceUpdater Price updater public key
 * @param feeQuoter Fee Quoter program ID
 * @returns [PDA, bump]
 */
export function findFqAllowedPriceUpdaterPDA(priceUpdater: PublicKey, feeQuoter: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("allowed_price_updater"), priceUpdater.toBuffer()],
    feeQuoter
  );
} 