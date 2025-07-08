import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface Delete_chain_configArgs {
  remote_chain_selector: BN
  mint: PublicKey
}

export interface Delete_chain_configAccounts {
  state: PublicKey
  chain_config: PublicKey
  authority: PublicKey
}

export const layout = borsh.struct([
  borsh.u64("remote_chain_selector"),
  borsh.publicKey("mint"),
])

export function delete_chain_config(
  args: Delete_chain_configArgs,
  accounts: Delete_chain_configAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.state, isSigner: false, isWritable: false },
    { pubkey: accounts.chain_config, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
  ]
  const identifier = Buffer.from([241, 159, 142, 210, 64, 173, 77, 179])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      remote_chain_selector: args.remote_chain_selector,
      mint: args.mint,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
