import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface ReleaseOrMintInV1Fields {
  originalSender: types.RemoteAddressFields
  remoteChainSelector: BN
  receiver: PublicKey
  amount: Array<number>
  localToken: PublicKey
  /**
   * @dev WARNING: sourcePoolAddress should be checked prior to any processing of funds. Make sure it matches the
   * expected pool address for the given remoteChainSelector.
   */
  sourcePoolAddress: types.RemoteAddressFields
  sourcePoolData: Uint8Array
  /** @dev WARNING: offchainTokenData is untrusted data. */
  offchainTokenData: Uint8Array
}

export interface ReleaseOrMintInV1JSON {
  originalSender: types.RemoteAddressJSON
  remoteChainSelector: string
  receiver: string
  amount: Array<number>
  localToken: string
  /**
   * @dev WARNING: sourcePoolAddress should be checked prior to any processing of funds. Make sure it matches the
   * expected pool address for the given remoteChainSelector.
   */
  sourcePoolAddress: types.RemoteAddressJSON
  sourcePoolData: Array<number>
  /** @dev WARNING: offchainTokenData is untrusted data. */
  offchainTokenData: Array<number>
}

export class ReleaseOrMintInV1 {
  readonly originalSender: types.RemoteAddress
  readonly remoteChainSelector: BN
  readonly receiver: PublicKey
  readonly amount: Array<number>
  readonly localToken: PublicKey
  /**
   * @dev WARNING: sourcePoolAddress should be checked prior to any processing of funds. Make sure it matches the
   * expected pool address for the given remoteChainSelector.
   */
  readonly sourcePoolAddress: types.RemoteAddress
  readonly sourcePoolData: Uint8Array
  /** @dev WARNING: offchainTokenData is untrusted data. */
  readonly offchainTokenData: Uint8Array

  constructor(fields: ReleaseOrMintInV1Fields) {
    this.originalSender = new types.RemoteAddress({ ...fields.originalSender })
    this.remoteChainSelector = fields.remoteChainSelector
    this.receiver = fields.receiver
    this.amount = fields.amount
    this.localToken = fields.localToken
    this.sourcePoolAddress = new types.RemoteAddress({
      ...fields.sourcePoolAddress,
    })
    this.sourcePoolData = fields.sourcePoolData
    this.offchainTokenData = fields.offchainTokenData
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        types.RemoteAddress.layout("originalSender"),
        borsh.u64("remoteChainSelector"),
        borsh.publicKey("receiver"),
        borsh.array(borsh.u8(), 32, "amount"),
        borsh.publicKey("localToken"),
        types.RemoteAddress.layout("sourcePoolAddress"),
        borsh.vecU8("sourcePoolData"),
        borsh.vecU8("offchainTokenData"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new ReleaseOrMintInV1({
      originalSender: types.RemoteAddress.fromDecoded(obj.originalSender),
      remoteChainSelector: obj.remoteChainSelector,
      receiver: obj.receiver,
      amount: obj.amount,
      localToken: obj.localToken,
      sourcePoolAddress: types.RemoteAddress.fromDecoded(obj.sourcePoolAddress),
      sourcePoolData: new Uint8Array(
        obj.sourcePoolData.buffer,
        obj.sourcePoolData.byteOffset,
        obj.sourcePoolData.length
      ),
      offchainTokenData: new Uint8Array(
        obj.offchainTokenData.buffer,
        obj.offchainTokenData.byteOffset,
        obj.offchainTokenData.length
      ),
    })
  }

  static toEncodable(fields: ReleaseOrMintInV1Fields) {
    return {
      originalSender: types.RemoteAddress.toEncodable(fields.originalSender),
      remoteChainSelector: fields.remoteChainSelector,
      receiver: fields.receiver,
      amount: fields.amount,
      localToken: fields.localToken,
      sourcePoolAddress: types.RemoteAddress.toEncodable(
        fields.sourcePoolAddress
      ),
      sourcePoolData: Buffer.from(
        fields.sourcePoolData.buffer,
        fields.sourcePoolData.byteOffset,
        fields.sourcePoolData.length
      ),
      offchainTokenData: Buffer.from(
        fields.offchainTokenData.buffer,
        fields.offchainTokenData.byteOffset,
        fields.offchainTokenData.length
      ),
    }
  }

  toJSON(): ReleaseOrMintInV1JSON {
    return {
      originalSender: this.originalSender.toJSON(),
      remoteChainSelector: this.remoteChainSelector.toString(),
      receiver: this.receiver.toString(),
      amount: this.amount,
      localToken: this.localToken.toString(),
      sourcePoolAddress: this.sourcePoolAddress.toJSON(),
      sourcePoolData: Array.from(this.sourcePoolData.values()),
      offchainTokenData: Array.from(this.offchainTokenData.values()),
    }
  }

  static fromJSON(obj: ReleaseOrMintInV1JSON): ReleaseOrMintInV1 {
    return new ReleaseOrMintInV1({
      originalSender: types.RemoteAddress.fromJSON(obj.originalSender),
      remoteChainSelector: new BN(obj.remoteChainSelector),
      receiver: new PublicKey(obj.receiver),
      amount: obj.amount,
      localToken: new PublicKey(obj.localToken),
      sourcePoolAddress: types.RemoteAddress.fromJSON(obj.sourcePoolAddress),
      sourcePoolData: Uint8Array.from(obj.sourcePoolData),
      offchainTokenData: Uint8Array.from(obj.offchainTokenData),
    })
  }

  toEncodable() {
    return ReleaseOrMintInV1.toEncodable(this)
  }
}
