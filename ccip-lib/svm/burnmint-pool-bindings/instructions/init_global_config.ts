import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface Init_global_configAccounts {
  config: PublicKey
  authority: PublicKey
  system_program: PublicKey
  program: PublicKey
  program_data: PublicKey
}

export function init_global_config(
  accounts: Init_global_configAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: accounts.system_program, isSigner: false, isWritable: false },
    { pubkey: accounts.program, isSigner: false, isWritable: false },
    { pubkey: accounts.program_data, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([140, 136, 214, 48, 87, 0, 120, 255])
  const data = identifier
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
