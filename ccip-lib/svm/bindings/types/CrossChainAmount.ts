import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface CrossChainAmountFields {
  leBytes: Array<number>
}

export interface CrossChainAmountJSON {
  leBytes: Array<number>
}

export class CrossChainAmount {
  readonly leBytes: Array<number>

  constructor(fields: CrossChainAmountFields) {
    this.leBytes = fields.leBytes
  }

  static layout(property?: string) {
    return borsh.struct([borsh.array(borsh.u8(), 32, "leBytes")], property)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new CrossChainAmount({
      leBytes: obj.leBytes,
    })
  }

  static toEncodable(fields: CrossChainAmountFields) {
    return {
      leBytes: fields.leBytes,
    }
  }

  toJSON(): CrossChainAmountJSON {
    return {
      leBytes: this.leBytes,
    }
  }

  static fromJSON(obj: CrossChainAmountJSON): CrossChainAmount {
    return new CrossChainAmount({
      leBytes: obj.leBytes,
    })
  }

  toEncodable() {
    return CrossChainAmount.toEncodable(this)
  }
}
