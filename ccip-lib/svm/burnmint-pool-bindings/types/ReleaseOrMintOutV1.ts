import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface ReleaseOrMintOutV1Fields {
  destination_amount: BN
}

export interface ReleaseOrMintOutV1JSON {
  destination_amount: string
}

export class ReleaseOrMintOutV1 {
  readonly destination_amount: BN

  constructor(fields: ReleaseOrMintOutV1Fields) {
    this.destination_amount = fields.destination_amount
  }

  static layout(property?: string) {
    return borsh.struct([borsh.u64("destination_amount")], property)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new ReleaseOrMintOutV1({
      destination_amount: obj.destination_amount,
    })
  }

  static toEncodable(fields: ReleaseOrMintOutV1Fields) {
    return {
      destination_amount: fields.destination_amount,
    }
  }

  toJSON(): ReleaseOrMintOutV1JSON {
    return {
      destination_amount: this.destination_amount.toString(),
    }
  }

  static fromJSON(obj: ReleaseOrMintOutV1JSON): ReleaseOrMintOutV1 {
    return new ReleaseOrMintOutV1({
      destination_amount: new BN(obj.destination_amount),
    })
  }

  toEncodable() {
    return ReleaseOrMintOutV1.toEncodable(this)
  }
}
