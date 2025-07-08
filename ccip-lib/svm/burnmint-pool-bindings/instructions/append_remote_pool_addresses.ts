import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface Append_remote_pool_addressesArgs {
  remote_chain_selector: BN
  _mint: PublicKey
  addresses: Array<types.RemoteAddressFields>
}

export interface Append_remote_pool_addressesAccounts {
  state: PublicKey
  chain_config: PublicKey
  authority: PublicKey
  system_program: PublicKey
}

export const layout = borsh.struct([
  borsh.u64("remote_chain_selector"),
  borsh.publicKey("_mint"),
  borsh.vec(types.RemoteAddress.layout(), "addresses"),
])

export function append_remote_pool_addresses(
  args: Append_remote_pool_addressesArgs,
  accounts: Append_remote_pool_addressesAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.state, isSigner: false, isWritable: false },
    { pubkey: accounts.chain_config, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: accounts.system_program, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([172, 57, 83, 55, 70, 112, 26, 197])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      remote_chain_selector: args.remote_chain_selector,
      _mint: args._mint,
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
