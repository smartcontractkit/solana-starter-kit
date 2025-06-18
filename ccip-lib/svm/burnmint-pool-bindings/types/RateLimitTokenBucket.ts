import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface RateLimitTokenBucketFields {
  tokens: BN
  last_updated: BN
  cfg: types.RateLimitConfigFields
}

export interface RateLimitTokenBucketJSON {
  tokens: string
  last_updated: string
  cfg: types.RateLimitConfigJSON
}

export class RateLimitTokenBucket {
  readonly tokens: BN
  readonly last_updated: BN
  readonly cfg: types.RateLimitConfig

  constructor(fields: RateLimitTokenBucketFields) {
    this.tokens = fields.tokens
    this.last_updated = fields.last_updated
    this.cfg = new types.RateLimitConfig({ ...fields.cfg })
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        borsh.u64("tokens"),
        borsh.u64("last_updated"),
        types.RateLimitConfig.layout("cfg"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new RateLimitTokenBucket({
      tokens: obj.tokens,
      last_updated: obj.last_updated,
      cfg: types.RateLimitConfig.fromDecoded(obj.cfg),
    })
  }

  static toEncodable(fields: RateLimitTokenBucketFields) {
    return {
      tokens: fields.tokens,
      last_updated: fields.last_updated,
      cfg: types.RateLimitConfig.toEncodable(fields.cfg),
    }
  }

  toJSON(): RateLimitTokenBucketJSON {
    return {
      tokens: this.tokens.toString(),
      last_updated: this.last_updated.toString(),
      cfg: this.cfg.toJSON(),
    }
  }

  static fromJSON(obj: RateLimitTokenBucketJSON): RateLimitTokenBucket {
    return new RateLimitTokenBucket({
      tokens: new BN(obj.tokens),
      last_updated: new BN(obj.last_updated),
      cfg: types.RateLimitConfig.fromJSON(obj.cfg),
    })
  }

  toEncodable() {
    return RateLimitTokenBucket.toEncodable(this)
  }
}
