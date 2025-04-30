import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface TransferOwnershipArgs {
  proposedOwner: PublicKey
}

export interface TransferOwnershipAccounts {
  state: PublicKey
  mint: PublicKey
  authority: PublicKey
}

export const layout = borsh.struct([borsh.publicKey("proposedOwner")])

export function transferOwnership(
  args: TransferOwnershipArgs,
  accounts: TransferOwnershipAccounts,
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
      proposedOwner: args.proposedOwner,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
