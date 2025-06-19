import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface ReleaseOrMintOutV1Fields {
  destinationAmount: BN
}

export interface ReleaseOrMintOutV1JSON {
  destinationAmount: string
}

export class ReleaseOrMintOutV1 {
  readonly destinationAmount: BN

  constructor(fields: ReleaseOrMintOutV1Fields) {
    this.destinationAmount = fields.destinationAmount
  }

  static layout(property?: string) {
    return borsh.struct([borsh.u64("destinationAmount")], property)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new ReleaseOrMintOutV1({
      destinationAmount: obj.destinationAmount,
    })
  }

  static toEncodable(fields: ReleaseOrMintOutV1Fields) {
    return {
      destinationAmount: fields.destinationAmount,
    }
  }

  toJSON(): ReleaseOrMintOutV1JSON {
    return {
      destinationAmount: this.destinationAmount.toString(),
    }
  }

  static fromJSON(obj: ReleaseOrMintOutV1JSON): ReleaseOrMintOutV1 {
    return new ReleaseOrMintOutV1({
      destinationAmount: new BN(obj.destinationAmount),
    })
  }

  toEncodable() {
    return ReleaseOrMintOutV1.toEncodable(this)
  }
}
