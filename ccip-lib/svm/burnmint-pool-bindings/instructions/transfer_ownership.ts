import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface Transfer_ownershipArgs {
  proposed_owner: PublicKey
}

export interface Transfer_ownershipAccounts {
  state: PublicKey
  mint: PublicKey
  authority: PublicKey
}

export const layout = borsh.struct([borsh.publicKey("proposed_owner")])

export function transfer_ownership(
  args: Transfer_ownershipArgs,
  accounts: Transfer_ownershipAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.state, isSigner: false, isWritable: true },
    { pubkey: accounts.mint, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
  ]
  const identifier = Buffer.from([65, 177, 215, 73, 53, 45, 99, 47])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      proposed_owner: args.proposed_owner,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
