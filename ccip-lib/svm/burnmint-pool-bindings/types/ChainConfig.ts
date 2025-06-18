import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface ChainConfigFields {
  base: types.BaseChainFields
}

export interface ChainConfigJSON {
  base: types.BaseChainJSON
}

export class ChainConfig {
  readonly base: types.BaseChain

  constructor(fields: ChainConfigFields) {
    this.base = new types.BaseChain({ ...fields.base })
  }

  static layout(property?: string) {
    return borsh.struct([types.BaseChain.layout("base")], property)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new ChainConfig({
      base: types.BaseChain.fromDecoded(obj.base),
    })
  }

  static toEncodable(fields: ChainConfigFields) {
    return {
      base: types.BaseChain.toEncodable(fields.base),
    }
  }

  toJSON(): ChainConfigJSON {
    return {
      base: this.base.toJSON(),
    }
  }

  static fromJSON(obj: ChainConfigJSON): ChainConfig {
    return new ChainConfig({
      base: types.BaseChain.fromJSON(obj.base),
    })
  }

  toEncodable() {
    return ChainConfig.toEncodable(this)
  }
}
