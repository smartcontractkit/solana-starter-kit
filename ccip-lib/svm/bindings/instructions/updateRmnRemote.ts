import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface UpdateRmnRemoteArgs {
  rmnRemote: PublicKey
}

export interface UpdateRmnRemoteAccounts {
  config: PublicKey
  authority: PublicKey
  systemProgram: PublicKey
}

export const layout = borsh.struct([borsh.publicKey("rmnRemote")])

/**
 * Updates the RMN remote program in the router configuration.
 * The Admin is the only one able to update the RMN remote program.
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for updating the configuration.
 * * `rmn_remote,` - The new RMN remote address.
 */
export function updateRmnRemote(
  args: UpdateRmnRemoteArgs,
  accounts: UpdateRmnRemoteAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([66, 12, 215, 147, 14, 176, 55, 214])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      rmnRemote: args.rmnRemote,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
