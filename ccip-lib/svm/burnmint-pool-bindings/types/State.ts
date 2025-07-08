import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface StateFields {
  version: number
  config: types.BaseConfigFields
}

export interface StateJSON {
  version: number
  config: types.BaseConfigJSON
}

export class State {
  readonly version: number
  readonly config: types.BaseConfig

  constructor(fields: StateFields) {
    this.version = fields.version
    this.config = new types.BaseConfig({ ...fields.config })
  }

  static layout(property?: string) {
    return borsh.struct(
      [borsh.u8("version"), types.BaseConfig.layout("config")],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new State({
      version: obj.version,
      config: types.BaseConfig.fromDecoded(obj.config),
    })
  }

  static toEncodable(fields: StateFields) {
    return {
      version: fields.version,
      config: types.BaseConfig.toEncodable(fields.config),
    }
  }

  toJSON(): StateJSON {
    return {
      version: this.version,
      config: this.config.toJSON(),
    }
  }

  static fromJSON(obj: StateJSON): State {
    return new State({
      version: obj.version,
      config: types.BaseConfig.fromJSON(obj.config),
    })
  }

  toEncodable() {
    return State.toEncodable(this)
  }
}
