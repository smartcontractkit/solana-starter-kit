import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface InitializeStateVersionArgs {
  mint: PublicKey
}

export interface InitializeStateVersionAccounts {
  state: PublicKey
}

export const layout = borsh.struct([borsh.publicKey("mint")])

export function initializeStateVersion(
  args: InitializeStateVersionArgs,
  accounts: InitializeStateVersionAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.state, isSigner: false, isWritable: true },
  ]
  const identifier = Buffer.from([54, 186, 181, 26, 2, 198, 200, 158])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      mint: args.mint,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
