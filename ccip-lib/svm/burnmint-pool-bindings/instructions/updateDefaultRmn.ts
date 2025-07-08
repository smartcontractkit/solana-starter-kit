import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface UpdateDefaultRmnArgs {
  rmnAddress: PublicKey
}

export interface UpdateDefaultRmnAccounts {
  config: PublicKey
  authority: PublicKey
  program: PublicKey
  programData: PublicKey
}

export const layout = borsh.struct([borsh.publicKey("rmnAddress")])

export function updateDefaultRmn(
  args: UpdateDefaultRmnArgs,
  accounts: UpdateDefaultRmnAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
    { pubkey: accounts.program, isSigner: false, isWritable: false },
    { pubkey: accounts.programData, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([204, 186, 36, 125, 180, 133, 227, 162])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      rmnAddress: args.rmnAddress,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
