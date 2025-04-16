import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface AcceptAdminRoleTokenAdminRegistryAccounts {
  config: PublicKey
  tokenAdminRegistry: PublicKey
  mint: PublicKey
  authority: PublicKey
}

/**
 * Accepts the admin role of the token admin registry.
 *
 * The Pending Admin must call this function to accept the admin role of the Token Admin Registry.
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for accepting the admin role.
 * * `mint` - The public key of the token mint.
 */
export function acceptAdminRoleTokenAdminRegistry(
  accounts: AcceptAdminRoleTokenAdminRegistryAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: false },
    { pubkey: accounts.tokenAdminRegistry, isSigner: false, isWritable: true },
    { pubkey: accounts.mint, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
  ]
  const identifier = Buffer.from([106, 240, 16, 173, 137, 213, 163, 246])
  const data = identifier
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
