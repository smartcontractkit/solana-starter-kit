import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface EditChainRemoteConfigArgs {
  remoteChainSelector: BN
  mint: PublicKey
  cfg: types.RemoteConfigFields
}

export interface EditChainRemoteConfigAccounts {
  state: PublicKey
  chainConfig: PublicKey
  authority: PublicKey
  systemProgram: PublicKey
}

export const layout = borsh.struct([
  borsh.u64("remoteChainSelector"),
  borsh.publicKey("mint"),
  types.RemoteConfig.layout("cfg"),
])

export function editChainRemoteConfig(
  args: EditChainRemoteConfigArgs,
  accounts: EditChainRemoteConfigAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.state, isSigner: false, isWritable: false },
    { pubkey: accounts.chainConfig, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([149, 112, 186, 72, 116, 217, 159, 175])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      remoteChainSelector: args.remoteChainSelector,
      mint: args.mint,
      cfg: types.RemoteConfig.toEncodable(args.cfg),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
