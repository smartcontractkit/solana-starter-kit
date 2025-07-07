import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface LockOrBurnTokensArgs {
  lockOrBurn: types.LockOrBurnInV1Fields
}

export interface LockOrBurnTokensAccounts {
  authority: PublicKey
  state: PublicKey
  tokenProgram: PublicKey
  mint: PublicKey
  poolSigner: PublicKey
  poolTokenAccount: PublicKey
  rmnRemote: PublicKey
  rmnRemoteCurses: PublicKey
  rmnRemoteConfig: PublicKey
  chainConfig: PublicKey
}

export const layout = borsh.struct([types.LockOrBurnInV1.layout("lockOrBurn")])

export function lockOrBurnTokens(
  args: LockOrBurnTokensArgs,
  accounts: LockOrBurnTokensAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.authority, isSigner: true, isWritable: false },
    { pubkey: accounts.state, isSigner: false, isWritable: false },
    { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.mint, isSigner: false, isWritable: true },
    { pubkey: accounts.poolSigner, isSigner: false, isWritable: false },
    { pubkey: accounts.poolTokenAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.rmnRemote, isSigner: false, isWritable: false },
    { pubkey: accounts.rmnRemoteCurses, isSigner: false, isWritable: false },
    { pubkey: accounts.rmnRemoteConfig, isSigner: false, isWritable: false },
    { pubkey: accounts.chainConfig, isSigner: false, isWritable: true },
  ]
  const identifier = Buffer.from([114, 161, 94, 29, 147, 25, 232, 191])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      lockOrBurn: types.LockOrBurnInV1.toEncodable(args.lockOrBurn),
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
