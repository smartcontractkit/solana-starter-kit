import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface ReleaseOrMintTokensArgs {
  releaseOrMint: types.ReleaseOrMintInV1Fields
}

export interface ReleaseOrMintTokensAccounts {
  authority: PublicKey
  /**
   * CHECK offramp program: exists only to derive the allowed offramp PDA
   * and the authority PDA.
   */
  offrampProgram: PublicKey
  /**
   * CHECK PDA of the router program verifying the signer is an allowed offramp.
   * If PDA does not exist, the router doesn't allow this offramp
   */
  allowedOfframp: PublicKey
  state: PublicKey
  tokenProgram: PublicKey
  mint: PublicKey
  poolSigner: PublicKey
  poolTokenAccount: PublicKey
  chainConfig: PublicKey
  rmnRemote: PublicKey
  rmnRemoteCurses: PublicKey
  rmnRemoteConfig: PublicKey
  receiverTokenAccount: PublicKey
}

export const layout = borsh.struct([
  types.ReleaseOrMintInV1.layout("releaseOrMint"),
])

export function releaseOrMintTokens(
  args: ReleaseOrMintTokensArgs,
  accounts: ReleaseOrMintTokensAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
    { pubkey: accounts.offrampProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.allowedOfframp, isSigner: false, isWritable: false },
    { pubkey: accounts.state, isSigner: false, isWritable: false },
    { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.mint, isSigner: false, isWritable: true },
    { pubkey: accounts.poolSigner, isSigner: false, isWritable: false },
    { pubkey: accounts.poolTokenAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.chainConfig, isSigner: false, isWritable: true },
    { pubkey: accounts.rmnRemote, isSigner: false, isWritable: false },
    { pubkey: accounts.rmnRemoteCurses, isSigner: false, isWritable: false },
    { pubkey: accounts.rmnRemoteConfig, isSigner: false, isWritable: false },
    {
      pubkey: accounts.receiverTokenAccount,
      isSigner: false,
      isWritable: true,
    },
  ]
  const identifier = Buffer.from([92, 100, 150, 198, 252, 63, 164, 228])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      releaseOrMint: types.ReleaseOrMintInV1.toEncodable(args.releaseOrMint),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
