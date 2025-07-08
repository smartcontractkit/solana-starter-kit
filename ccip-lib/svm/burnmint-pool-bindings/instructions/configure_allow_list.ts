import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface Configure_allow_listArgs {
  add: Array<PublicKey>
  enabled: boolean
}

export interface Configure_allow_listAccounts {
  state: PublicKey
  mint: PublicKey
  authority: PublicKey
  system_program: PublicKey
}

export const layout = borsh.struct([
  borsh.vec(borsh.publicKey(), "add"),
  borsh.bool("enabled"),
])

export function configure_allow_list(
  args: Configure_allow_listArgs,
  accounts: Configure_allow_listAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.state, isSigner: false, isWritable: true },
    { pubkey: accounts.mint, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: accounts.system_program, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([18, 180, 102, 187, 209, 0, 130, 191])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      add: args.add,
      enabled: args.enabled,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
