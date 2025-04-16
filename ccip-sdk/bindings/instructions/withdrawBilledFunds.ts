import { TransactionInstruction, PublicKey, AccountMeta } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface WithdrawBilledFundsArgs {
  transferAll: boolean
  desiredAmount: BN
}

export interface WithdrawBilledFundsAccounts {
  feeTokenMint: PublicKey
  feeTokenAccum: PublicKey
  recipient: PublicKey
  tokenProgram: PublicKey
  feeBillingSigner: PublicKey
  config: PublicKey
  authority: PublicKey
}

export const layout = borsh.struct([
  borsh.bool("transferAll"),
  borsh.u64("desiredAmount"),
])

/**
 * Billing //
 * Transfers the accumulated billed fees in a particular token to an arbitrary token account.
 * Only the CCIP Admin can withdraw billed funds.
 *
 * # Arguments
 *
 * * `ctx` - The context containing the accounts required for the transfer of billed fees.
 * * `transfer_all` - A flag indicating whether to transfer all the accumulated fees in that token or not.
 * * `desired_amount` - The amount to transfer. If `transfer_all` is true, this value must be 0.
 */
export function withdrawBilledFunds(
  args: WithdrawBilledFundsArgs,
  accounts: WithdrawBilledFundsAccounts,
  programId: PublicKey = PROGRAM_ID
) {
  const keys: Array<AccountMeta> = [
    { pubkey: accounts.feeTokenMint, isSigner: false, isWritable: false },
    { pubkey: accounts.feeTokenAccum, isSigner: false, isWritable: true },
    { pubkey: accounts.recipient, isSigner: false, isWritable: true },
    { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
    { pubkey: accounts.feeBillingSigner, isSigner: false, isWritable: false },
    { pubkey: accounts.config, isSigner: false, isWritable: false },
    { pubkey: accounts.authority, isSigner: true, isWritable: true },
  ]
  const identifier = Buffer.from([16, 116, 73, 38, 77, 232, 6, 28])
  const buffer = Buffer.alloc(1000)
  const len = layout.encode(
    {
      transferAll: args.transferAll,
      desiredAmount: args.desiredAmount,
    },
    buffer
  )
  const data = Buffer.concat([identifier, buffer]).slice(0, 8 + len)
  const ix = new TransactionInstruction({ keys, programId, data })
  return ix
}
