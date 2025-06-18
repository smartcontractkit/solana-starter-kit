import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface BaseChainFields {
  remote: types.RemoteConfigFields
  inbound_rate_limit: types.RateLimitTokenBucketFields
  outbound_rate_limit: types.RateLimitTokenBucketFields
}

export interface BaseChainJSON {
  remote: types.RemoteConfigJSON
  inbound_rate_limit: types.RateLimitTokenBucketJSON
  outbound_rate_limit: types.RateLimitTokenBucketJSON
}

export class BaseChain {
  readonly remote: types.RemoteConfig
  readonly inbound_rate_limit: types.RateLimitTokenBucket
  readonly outbound_rate_limit: types.RateLimitTokenBucket

  constructor(fields: BaseChainFields) {
    this.remote = new types.RemoteConfig({ ...fields.remote })
    this.inbound_rate_limit = new types.RateLimitTokenBucket({
      ...fields.inbound_rate_limit,
    })
    this.outbound_rate_limit = new types.RateLimitTokenBucket({
      ...fields.outbound_rate_limit,
    })
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        types.RemoteConfig.layout("remote"),
        types.RateLimitTokenBucket.layout("inbound_rate_limit"),
        types.RateLimitTokenBucket.layout("outbound_rate_limit"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new BaseChain({
      remote: types.RemoteConfig.fromDecoded(obj.remote),
      inbound_rate_limit: types.RateLimitTokenBucket.fromDecoded(
        obj.inbound_rate_limit
      ),
      outbound_rate_limit: types.RateLimitTokenBucket.fromDecoded(
        obj.outbound_rate_limit
      ),
    })
  }

  static toEncodable(fields: BaseChainFields) {
    return {
      remote: types.RemoteConfig.toEncodable(fields.remote),
      inbound_rate_limit: types.RateLimitTokenBucket.toEncodable(
        fields.inbound_rate_limit
      ),
      outbound_rate_limit: types.RateLimitTokenBucket.toEncodable(
        fields.outbound_rate_limit
      ),
    }
  }

  toJSON(): BaseChainJSON {
    return {
      remote: this.remote.toJSON(),
      inbound_rate_limit: this.inbound_rate_limit.toJSON(),
      outbound_rate_limit: this.outbound_rate_limit.toJSON(),
    }
  }

  static fromJSON(obj: BaseChainJSON): BaseChain {
    return new BaseChain({
      remote: types.RemoteConfig.fromJSON(obj.remote),
      inbound_rate_limit: types.RateLimitTokenBucket.fromJSON(
        obj.inbound_rate_limit
      ),
      outbound_rate_limit: types.RateLimitTokenBucket.fromJSON(
        obj.outbound_rate_limit
      ),
    })
  }

  toEncodable() {
    return BaseChain.toEncodable(this)
  }
}
