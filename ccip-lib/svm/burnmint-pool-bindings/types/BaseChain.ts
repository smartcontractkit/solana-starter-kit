import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface BaseChainFields {
  remote: types.RemoteConfigFields
  inboundRateLimit: types.RateLimitTokenBucketFields
  outboundRateLimit: types.RateLimitTokenBucketFields
}

export interface BaseChainJSON {
  remote: types.RemoteConfigJSON
  inboundRateLimit: types.RateLimitTokenBucketJSON
  outboundRateLimit: types.RateLimitTokenBucketJSON
}

export class BaseChain {
  readonly remote: types.RemoteConfig
  readonly inboundRateLimit: types.RateLimitTokenBucket
  readonly outboundRateLimit: types.RateLimitTokenBucket

  constructor(fields: BaseChainFields) {
    this.remote = new types.RemoteConfig({ ...fields.remote })
    this.inboundRateLimit = new types.RateLimitTokenBucket({
      ...fields.inboundRateLimit,
    })
    this.outboundRateLimit = new types.RateLimitTokenBucket({
      ...fields.outboundRateLimit,
    })
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        types.RemoteConfig.layout("remote"),
        types.RateLimitTokenBucket.layout("inboundRateLimit"),
        types.RateLimitTokenBucket.layout("outboundRateLimit"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new BaseChain({
      remote: types.RemoteConfig.fromDecoded(obj.remote),
      inboundRateLimit: types.RateLimitTokenBucket.fromDecoded(
        obj.inboundRateLimit
      ),
      outboundRateLimit: types.RateLimitTokenBucket.fromDecoded(
        obj.outboundRateLimit
      ),
    })
  }

  static toEncodable(fields: BaseChainFields) {
    return {
      remote: types.RemoteConfig.toEncodable(fields.remote),
      inboundRateLimit: types.RateLimitTokenBucket.toEncodable(
        fields.inboundRateLimit
      ),
      outboundRateLimit: types.RateLimitTokenBucket.toEncodable(
        fields.outboundRateLimit
      ),
    }
  }

  toJSON(): BaseChainJSON {
    return {
      remote: this.remote.toJSON(),
      inboundRateLimit: this.inboundRateLimit.toJSON(),
      outboundRateLimit: this.outboundRateLimit.toJSON(),
    }
  }

  static fromJSON(obj: BaseChainJSON): BaseChain {
    return new BaseChain({
      remote: types.RemoteConfig.fromJSON(obj.remote),
      inboundRateLimit: types.RateLimitTokenBucket.fromJSON(
        obj.inboundRateLimit
      ),
      outboundRateLimit: types.RateLimitTokenBucket.fromJSON(
        obj.outboundRateLimit
      ),
    })
  }

  toEncodable() {
    return BaseChain.toEncodable(this)
  }
}
