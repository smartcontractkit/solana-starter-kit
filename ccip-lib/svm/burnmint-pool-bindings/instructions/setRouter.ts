import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface SetRouterArgs {
  newRouter: PublicKey
}

export interface SetRouterAccounts {
  state: PublicKey
  mint: PublicKey
  authority: PublicKey
  program: PublicKey
  programData: PublicKey
}

export const layout = borsh.struct([borsh.publicKey("newRouter")])

export function setRouter(
  args: SetRouterArgs,
  accounts: SetRouterAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.state, isSigner: false, isWritable: false },
    { pubkey: accounts.mint, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: accounts.program, isSigner: false, isWritable: false },
    { pubkey: accounts.programData, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([236, 248, 107, 200, 151, 160, 44, 250])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      newRouter: args.newRouter,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
