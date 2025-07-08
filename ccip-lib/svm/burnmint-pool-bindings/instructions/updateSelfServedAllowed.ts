import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface UpdateSelfServedAllowedArgs {
  selfServedAllowed: boolean
}

export interface UpdateSelfServedAllowedAccounts {
  config: PublicKey
  authority: PublicKey
  program: PublicKey
  programData: PublicKey
}

export const layout = borsh.struct([borsh.bool("selfServedAllowed")])

export function updateSelfServedAllowed(
  args: UpdateSelfServedAllowedArgs,
  accounts: UpdateSelfServedAllowedAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
    { pubkey: accounts.program, isSigner: false, isWritable: false },
    { pubkey: accounts.programData, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([210, 165, 57, 132, 64, 203, 100, 73])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      selfServedAllowed: args.selfServedAllowed,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
