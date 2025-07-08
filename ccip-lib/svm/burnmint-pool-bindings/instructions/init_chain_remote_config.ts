import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface Init_chain_remote_configArgs {
  remote_chain_selector: BN
  mint: PublicKey
  cfg: types.RemoteConfigFields
}

export interface Init_chain_remote_configAccounts {
  state: PublicKey
  chain_config: PublicKey
  authority: PublicKey
  system_program: PublicKey
}

export const layout = borsh.struct([
  borsh.u64("remote_chain_selector"),
  borsh.publicKey("mint"),
  types.RemoteConfig.layout("cfg"),
])

export function init_chain_remote_config(
  args: Init_chain_remote_configArgs,
  accounts: Init_chain_remote_configAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.state, isSigner: false, isWritable: false },
    { pubkey: accounts.chain_config, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: accounts.system_program, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([21, 150, 133, 36, 2, 116, 199, 129])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      remote_chain_selector: args.remote_chain_selector,
      mint: args.mint,
      cfg: types.RemoteConfig.toEncodable(args.cfg),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
