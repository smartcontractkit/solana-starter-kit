import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface Lock_or_burn_tokensArgs {
  lock_or_burn: types.LockOrBurnInV1Fields
}

export interface Lock_or_burn_tokensAccounts {
  authority: PublicKey
  state: PublicKey
  token_program: PublicKey
  mint: PublicKey
  pool_signer: PublicKey
  pool_token_account: PublicKey
  rmn_remote: PublicKey
  rmn_remote_curses: PublicKey
  rmn_remote_config: PublicKey
  chain_config: PublicKey
}

export const layout = borsh.struct([
  types.LockOrBurnInV1.layout("lock_or_burn"),
])

export function lock_or_burn_tokens(
  args: Lock_or_burn_tokensArgs,
  accounts: Lock_or_burn_tokensAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
    { pubkey: accounts.state, isSigner: false, isWritable: false },
    { pubkey: accounts.token_program, isSigner: false, isWritable: false },
    { pubkey: accounts.mint, isSigner: false, isWritable: true },
    { pubkey: accounts.pool_signer, isSigner: false, isWritable: false },
    { pubkey: accounts.pool_token_account, isSigner: false, isWritable: true },
    { pubkey: accounts.rmn_remote, isSigner: false, isWritable: false },
    { pubkey: accounts.rmn_remote_curses, isSigner: false, isWritable: false },
    { pubkey: accounts.rmn_remote_config, isSigner: false, isWritable: false },
    { pubkey: accounts.chain_config, isSigner: false, isWritable: true },
  ]
  const identifier = Buffer.from([114, 161, 94, 29, 147, 25, 232, 191])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      lock_or_burn: types.LockOrBurnInV1.toEncodable(args.lock_or_burn),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
