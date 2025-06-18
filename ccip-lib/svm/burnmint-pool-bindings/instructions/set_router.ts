import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface Set_routerArgs {
  new_router: PublicKey
}

export interface Set_routerAccounts {
  state: PublicKey
  mint: PublicKey
  authority: PublicKey
}

export const layout = borsh.struct([borsh.publicKey("new_router")])

export function set_router(
  args: Set_routerArgs,
  accounts: Set_routerAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.state, isSigner: false, isWritable: true },
    { pubkey: accounts.mint, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
  ]
  const identifier = Buffer.from([236, 248, 107, 200, 151, 160, 44, 250])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      new_router: args.new_router,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
