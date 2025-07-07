import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface InitGlobalConfigArgs {
  routerAddress: PublicKey
  rmnAddress: PublicKey
}

export interface InitGlobalConfigAccounts {
  config: PublicKey
  authority: PublicKey
  systemProgram: PublicKey
  program: PublicKey
  programData: PublicKey
}

export const layout = borsh.struct([
  borsh.publicKey("routerAddress"),
  borsh.publicKey("rmnAddress"),
])

export function initGlobalConfig(
  args: InitGlobalConfigArgs,
  accounts: InitGlobalConfigAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.program, isSigner: false, isWritable: false },
    { pubkey: accounts.programData, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([140, 136, 214, 48, 87, 0, 120, 255])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      routerAddress: args.routerAddress,
      rmnAddress: args.rmnAddress,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
