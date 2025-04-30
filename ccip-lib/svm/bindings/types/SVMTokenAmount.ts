import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface SVMTokenAmountFields {
  token: PublicKey
  amount: BN
}

export interface SVMTokenAmountJSON {
  token: string
  amount: string
}

export class SVMTokenAmount {
  readonly token: PublicKey
  readonly amount: BN

  constructor(fields: SVMTokenAmountFields) {
    this.token = fields.token
    this.amount = fields.amount
  }

  static layout(property?: string) {
    return borsh.struct(
      [borsh.publicKey("token"), borsh.u64("amount")],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new SVMTokenAmount({
      token: obj.token,
      amount: obj.amount,
    })
  }

  static toEncodable(fields: SVMTokenAmountFields) {
    return {
      token: fields.token,
      amount: fields.amount,
    }
  }

  toJSON(): SVMTokenAmountJSON {
    return {
      token: this.token.toString(),
      amount: this.amount.toString(),
    }
  }

  static fromJSON(obj: SVMTokenAmountJSON): SVMTokenAmount {
    return new SVMTokenAmount({
      token: new PublicKey(obj.token),
      amount: new BN(obj.amount),
    })
  }

  toEncodable() {
    return SVMTokenAmount.toEncodable(this)
  }
}
