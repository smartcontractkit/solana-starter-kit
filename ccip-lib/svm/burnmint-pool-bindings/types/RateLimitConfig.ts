import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface RateLimitConfigFields {
  enabled: boolean
  capacity: BN
  rate: BN
}

export interface RateLimitConfigJSON {
  enabled: boolean
  capacity: string
  rate: string
}

export class RateLimitConfig {
  readonly enabled: boolean
  readonly capacity: BN
  readonly rate: BN

  constructor(fields: RateLimitConfigFields) {
    this.enabled = fields.enabled
    this.capacity = fields.capacity
    this.rate = fields.rate
  }

  static layout(property?: string) {
    return borsh.struct(
      [borsh.bool("enabled"), borsh.u64("capacity"), borsh.u64("rate")],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new RateLimitConfig({
      enabled: obj.enabled,
      capacity: obj.capacity,
      rate: obj.rate,
    })
  }

  static toEncodable(fields: RateLimitConfigFields) {
    return {
      enabled: fields.enabled,
      capacity: fields.capacity,
      rate: fields.rate,
    }
  }

  toJSON(): RateLimitConfigJSON {
    return {
      enabled: this.enabled,
      capacity: this.capacity.toString(),
      rate: this.rate.toString(),
    }
  }

  static fromJSON(obj: RateLimitConfigJSON): RateLimitConfig {
    return new RateLimitConfig({
      enabled: obj.enabled,
      capacity: new BN(obj.capacity),
      rate: new BN(obj.rate),
    })
  }

  toEncodable() {
    return RateLimitConfig.toEncodable(this)
  }
}
