import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface DeleteChainConfigArgs {
  remoteChainSelector: BN
  mint: PublicKey
}

export interface DeleteChainConfigAccounts {
  state: PublicKey
  chainConfig: PublicKey
  authority: PublicKey
}

export const layout = borsh.struct([
  borsh.u64("remoteChainSelector"),
  borsh.publicKey("mint"),
])

export function deleteChainConfig(
  args: DeleteChainConfigArgs,
  accounts: DeleteChainConfigAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.state, isSigner: false, isWritable: false },
    { pubkey: accounts.chainConfig, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
  ]
  const identifier = Buffer.from([241, 159, 142, 210, 64, 173, 77, 179])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      remoteChainSelector: args.remoteChainSelector,
      mint: args.mint,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
