import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface Release_or_mint_tokensArgs {
  release_or_mint: types.ReleaseOrMintInV1Fields
}

export interface Release_or_mint_tokensAccounts {
  authority: PublicKey
  /**
   * CHECK offramp program: exists only to derive the allowed offramp PDA
   * and the authority PDA.
   */
  offramp_program: PublicKey
  /**
   * CHECK PDA of the router program verifying the signer is an allowed offramp.
   * If PDA does not exist, the router doesn't allow this offramp
   */
  allowed_offramp: PublicKey
  state: PublicKey
  token_program: PublicKey
  mint: PublicKey
  pool_signer: PublicKey
  pool_token_account: PublicKey
  chain_config: PublicKey
  rmn_remote: PublicKey
  rmn_remote_curses: PublicKey
  rmn_remote_config: PublicKey
  receiver_token_account: PublicKey
}

export const layout = borsh.struct([
  types.ReleaseOrMintInV1.layout("release_or_mint"),
])

export function release_or_mint_tokens(
  args: Release_or_mint_tokensArgs,
  accounts: Release_or_mint_tokensAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
    { pubkey: accounts.offramp_program, isSigner: false, isWritable: false },
    { pubkey: accounts.allowed_offramp, isSigner: false, isWritable: false },
    { pubkey: accounts.state, isSigner: false, isWritable: false },
    { pubkey: accounts.token_program, isSigner: false, isWritable: false },
    { pubkey: accounts.mint, isSigner: false, isWritable: true },
    { pubkey: accounts.pool_signer, isSigner: false, isWritable: false },
    { pubkey: accounts.pool_token_account, isSigner: false, isWritable: true },
    { pubkey: accounts.chain_config, isSigner: false, isWritable: true },
    { pubkey: accounts.rmn_remote, isSigner: false, isWritable: false },
    { pubkey: accounts.rmn_remote_curses, isSigner: false, isWritable: false },
    { pubkey: accounts.rmn_remote_config, isSigner: false, isWritable: false },
    {
      pubkey: accounts.receiver_token_account,
      isSigner: false,
      isWritable: true,
    },
  ]
  const identifier = Buffer.from([92, 100, 150, 198, 252, 63, 164, 228])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      release_or_mint: types.ReleaseOrMintInV1.toEncodable(
        args.release_or_mint
      ),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
