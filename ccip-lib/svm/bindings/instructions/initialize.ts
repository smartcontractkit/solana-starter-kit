import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface InitializeArgs {
  svmChainSelector: BN
  feeAggregator: PublicKey
  feeQuoter: PublicKey
  linkTokenMint: PublicKey
  rmnRemote: PublicKey
}

export interface InitializeAccounts {
  config: PublicKey
  authority: PublicKey
  systemProgram: PublicKey
  program: PublicKey
  programData: PublicKey
}

export const layout = borsh.struct([
  borsh.u64("svmChainSelector"),
  borsh.publicKey("feeAggregator"),
  borsh.publicKey("feeQuoter"),
  borsh.publicKey("linkTokenMint"),
  borsh.publicKey("rmnRemote"),
])

/**
 * Initialization Flow //
 * Initializes the CCIP Router.
 *
 * The initialization of the Router is responsibility of Admin, nothing more than calling this method should be done first.
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for initialization.
 * * `svm_chain_selector` - The chain selector for SVM.
 * * `fee_aggregator` - The public key of the fee aggregator.
 * * `fee_quoter` - The public key of the fee quoter.
 * * `link_token_mint` - The public key of the LINK token mint.
 * * `rmn_remote` - The public key of the RMN remote.
 */
export function initialize(
  args: InitializeArgs,
  accounts: InitializeAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.config, isSigner: false, isWritable: true },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
    { pubkey: accounts.systemProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.program, isSigner: false, isWritable: false },
    { pubkey: accounts.programData, isSigner: false, isWritable: false },
  ]
  const identifier = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      svmChainSelector: args.svmChainSelector,
      feeAggregator: args.feeAggregator,
      feeQuoter: args.feeQuoter,
      linkTokenMint: args.linkTokenMint,
      rmnRemote: args.rmnRemote,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
