import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface SetPoolArgs {
  writableIndexes: Uint8Array
}

export interface SetPoolAccounts {
  config: PublicKey
  tokenAdminRegistry: PublicKey
  mint: PublicKey
  poolLookuptable: PublicKey
  authority: PublicKey
}

export const layout = borsh.struct([borsh.vecU8("writableIndexes")])

/**
 * Sets the pool lookup table for a given token mint.
 *
 * The administrator of the token admin registry can set the pool lookup table for a given token mint.
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for setting the pool.
 * * `writable_indexes` - a bit map of the indexes of the accounts in lookup table that are writable
 */
export function setPool(
  args: SetPoolArgs,
  accounts: SetPoolAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: false },
    { pubkey: accounts.tokenAdminRegistry, isSigner: false, isWritable: true },
    { pubkey: accounts.mint, isSigner: false, isWritable: false },
    { pubkey: accounts.poolLookuptable, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
  ]
  const identifier = Buffer.from([119, 30, 14, 180, 115, 225, 167, 238])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      writableIndexes: Buffer.from(
        args.writableIndexes.buffer,
        args.writableIndexes.byteOffset,
        args.writableIndexes.length
      ),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
