import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface ReleaseOrMintInV1Fields {
  original_sender: types.RemoteAddressFields
  remote_chain_selector: BN
  receiver: PublicKey
  amount: Array<number>
  local_token: PublicKey
  /**
   * @dev WARNING: sourcePoolAddress should be checked prior to any processing of funds. Make sure it matches the
   * expected pool address for the given remoteChainSelector.
   */
  source_pool_address: types.RemoteAddressFields
  source_pool_data: Uint8Array
  /** @dev WARNING: offchainTokenData is untrusted data. */
  offchain_token_data: Uint8Array
}

export interface ReleaseOrMintInV1JSON {
  original_sender: types.RemoteAddressJSON
  remote_chain_selector: string
  receiver: string
  amount: Array<number>
  local_token: string
  /**
   * @dev WARNING: sourcePoolAddress should be checked prior to any processing of funds. Make sure it matches the
   * expected pool address for the given remoteChainSelector.
   */
  source_pool_address: types.RemoteAddressJSON
  source_pool_data: Array<number>
  /** @dev WARNING: offchainTokenData is untrusted data. */
  offchain_token_data: Array<number>
}

export class ReleaseOrMintInV1 {
  readonly original_sender: types.RemoteAddress
  readonly remote_chain_selector: BN
  readonly receiver: PublicKey
  readonly amount: Array<number>
  readonly local_token: PublicKey
  /**
   * @dev WARNING: sourcePoolAddress should be checked prior to any processing of funds. Make sure it matches the
   * expected pool address for the given remoteChainSelector.
   */
  readonly source_pool_address: types.RemoteAddress
  readonly source_pool_data: Uint8Array
  /** @dev WARNING: offchainTokenData is untrusted data. */
  readonly offchain_token_data: Uint8Array

  constructor(fields: ReleaseOrMintInV1Fields) {
    this.original_sender = new types.RemoteAddress({
      ...fields.original_sender,
    })
    this.remote_chain_selector = fields.remote_chain_selector
    this.receiver = fields.receiver
    this.amount = fields.amount
    this.local_token = fields.local_token
    this.source_pool_address = new types.RemoteAddress({
      ...fields.source_pool_address,
    })
    this.source_pool_data = fields.source_pool_data
    this.offchain_token_data = fields.offchain_token_data
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        types.RemoteAddress.layout("original_sender"),
        borsh.u64("remote_chain_selector"),
        borsh.publicKey("receiver"),
        borsh.array(borsh.u8(), 32, "amount"),
        borsh.publicKey("local_token"),
        types.RemoteAddress.layout("source_pool_address"),
        borsh.vecU8("source_pool_data"),
        borsh.vecU8("offchain_token_data"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new ReleaseOrMintInV1({
      original_sender: types.RemoteAddress.fromDecoded(obj.original_sender),
      remote_chain_selector: obj.remote_chain_selector,
      receiver: new PublicKey(obj.receiver),
      amount: obj.amount,
      local_token: new PublicKey(obj.local_token),
      source_pool_address: types.RemoteAddress.fromDecoded(
        obj.source_pool_address
      ),
      source_pool_data: new Uint8Array(
        obj.source_pool_data.buffer,
        obj.source_pool_data.byteOffset,
        obj.source_pool_data.length
      ),
      offchain_token_data: new Uint8Array(
        obj.offchain_token_data.buffer,
        obj.offchain_token_data.byteOffset,
        obj.offchain_token_data.length
      ),
    })
  }

  static toEncodable(fields: ReleaseOrMintInV1Fields) {
    return {
      original_sender: types.RemoteAddress.toEncodable(fields.original_sender),
      remote_chain_selector: fields.remote_chain_selector,
      receiver: fields.receiver,
      amount: fields.amount,
      local_token: fields.local_token,
      source_pool_address: types.RemoteAddress.toEncodable(
        fields.source_pool_address
      ),
      source_pool_data: Buffer.from(
        fields.source_pool_data.buffer,
        fields.source_pool_data.byteOffset,
        fields.source_pool_data.length
      ),
      offchain_token_data: Buffer.from(
        fields.offchain_token_data.buffer,
        fields.offchain_token_data.byteOffset,
        fields.offchain_token_data.length
      ),
    }
  }

  toJSON(): ReleaseOrMintInV1JSON {
    return {
      original_sender: this.original_sender.toJSON(),
      remote_chain_selector: this.remote_chain_selector.toString(),
      receiver: this.receiver.toString(),
      amount: this.amount,
      local_token: this.local_token.toString(),
      source_pool_address: this.source_pool_address.toJSON(),
      source_pool_data: Array.from(this.source_pool_data.values()),
      offchain_token_data: Array.from(this.offchain_token_data.values()),
    }
  }

  static fromJSON(obj: ReleaseOrMintInV1JSON): ReleaseOrMintInV1 {
    return new ReleaseOrMintInV1({
      original_sender: types.RemoteAddress.fromJSON(obj.original_sender),
      remote_chain_selector: new BN(obj.remote_chain_selector),
      receiver: new PublicKey(obj.receiver),
      amount: obj.amount,
      local_token: new PublicKey(obj.local_token),
      source_pool_address: types.RemoteAddress.fromJSON(
        obj.source_pool_address
      ),
      source_pool_data: Uint8Array.from(obj.source_pool_data),
      offchain_token_data: Uint8Array.from(obj.offchain_token_data),
    })
  }

  toEncodable() {
    return ReleaseOrMintInV1.toEncodable(this)
  }
}
