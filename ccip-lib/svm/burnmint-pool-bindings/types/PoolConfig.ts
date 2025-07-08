import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface PoolConfigFields {
  version: number
  self_served_allowed: boolean
}

export interface PoolConfigJSON {
  version: number
  self_served_allowed: boolean
}

export class PoolConfig {
  readonly version: number
  readonly self_served_allowed: boolean

  constructor(fields: PoolConfigFields) {
    this.version = fields.version
    this.self_served_allowed = fields.self_served_allowed
  }

  static layout(property?: string) {
    return borsh.struct(
      [borsh.u8("version"), borsh.bool("self_served_allowed")],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new PoolConfig({
      version: obj.version,
      self_served_allowed: obj.self_served_allowed,
    })
  }

  static toEncodable(fields: PoolConfigFields) {
    return {
      version: fields.version,
      self_served_allowed: fields.self_served_allowed,
    }
  }

  toJSON(): PoolConfigJSON {
    return {
      version: this.version,
      self_served_allowed: this.self_served_allowed,
    }
  }

  static fromJSON(obj: PoolConfigJSON): PoolConfig {
    return new PoolConfig({
      version: obj.version,
      self_served_allowed: obj.self_served_allowed,
    })
  }

  toEncodable() {
    return PoolConfig.toEncodable(this)
  }
}
