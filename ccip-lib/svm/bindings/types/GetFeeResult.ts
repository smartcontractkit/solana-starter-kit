import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface GetFeeResultFields {
  amount: BN
  juels: BN
  token: PublicKey
}

export interface GetFeeResultJSON {
  amount: string
  juels: string
  token: string
}

export class GetFeeResult {
  readonly amount: BN
  readonly juels: BN
  readonly token: PublicKey

  constructor(fields: GetFeeResultFields) {
    this.amount = fields.amount
    this.juels = fields.juels
    this.token = fields.token
  }

  static layout(property?: string) {
    return borsh.struct(
      [borsh.u64("amount"), borsh.u128("juels"), borsh.publicKey("token")],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new GetFeeResult({
      amount: obj.amount,
      juels: obj.juels,
      token: obj.token,
    })
  }

  static toEncodable(fields: GetFeeResultFields) {
    return {
      amount: fields.amount,
      juels: fields.juels,
      token: fields.token,
    }
  }

  toJSON(): GetFeeResultJSON {
    return {
      amount: this.amount.toString(),
      juels: this.juels.toString(),
      token: this.token.toString(),
    }
  }

  static fromJSON(obj: GetFeeResultJSON): GetFeeResult {
    return new GetFeeResult({
      amount: new BN(obj.amount),
      juels: new BN(obj.juels),
      token: new PublicKey(obj.token),
    })
  }

  toEncodable() {
    return GetFeeResult.toEncodable(this)
  }
}
