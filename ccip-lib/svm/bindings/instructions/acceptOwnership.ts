import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface AcceptOwnershipAccounts {
  config: PublicKey
  authority: PublicKey
}

/**
 * Accepts the ownership of the router by the proposed owner.
 *
 * Shared func signature with other programs
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for accepting ownership.
 * The new owner must be a signer of the transaction.
 */
export function acceptOwnership(
  accounts: AcceptOwnershipAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
  ]
  const identifier = Buffer.from([172, 23, 43, 13, 238, 213, 85, 150])
  const data = identifier
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
