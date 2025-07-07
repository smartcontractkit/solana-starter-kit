import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface TypeVersionAccounts {
  clock: PublicKey
}

/**
 * Returns the program type (name) and version.
 * Used by offchain code to easily determine which program & version is being interacted with.
 *
 * # Arguments
 * * `ctx` - The context
 */
export function typeVersion(
  accounts: TypeVersionAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.clock, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([129, 251, 8, 243, 122, 229, 252, 164])
  const data = identifier
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
