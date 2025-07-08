import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface Initialize_state_versionArgs {
  _mint: PublicKey
}

export interface Initialize_state_versionAccounts {
  state: PublicKey
}

export const layout = borsh.struct([borsh.publicKey("_mint")])

export function initialize_state_version(
  args: Initialize_state_versionArgs,
  accounts: Initialize_state_versionAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.state, isSigner: false, isWritable: true },
  ]
  const identifier = Buffer.from([54, 186, 181, 26, 2, 198, 200, 158])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      _mint: args._mint,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
