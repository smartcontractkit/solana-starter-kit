import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface AppendRemotePoolAddressesArgs {
  remoteChainSelector: BN
  mint: PublicKey
  addresses: Array<types.RemoteAddressFields>
}

export interface AppendRemotePoolAddressesAccounts {
  state: PublicKey
  chainConfig: PublicKey
  authority: PublicKey
  systemProgram: PublicKey
}

export const layout = borsh.struct([
  borsh.u64("remoteChainSelector"),
  borsh.publicKey("mint"),
  borsh.vec(types.RemoteAddress.layout(), "addresses"),
])

export function appendRemotePoolAddresses(
  args: AppendRemotePoolAddressesArgs,
  accounts: AppendRemotePoolAddressesAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.state, isSigner: false, isWritable: false },
    { pubkey: accounts.chainConfig, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([172, 57, 83, 55, 70, 112, 26, 197])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      remoteChainSelector: args.remoteChainSelector,
      mint: args.mint,
      addresses: args.addresses.map((item) =>
        types.RemoteAddress.toEncodable(item)
      ),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
