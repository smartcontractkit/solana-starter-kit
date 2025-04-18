import { PublicKey, Connection } from "@solana/web3.js"
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface ConfigFields {
  version: number
  defaultCodeVersion: types.CodeVersionKind
  svmChainSelector: BN
  owner: PublicKey
  proposedOwner: PublicKey
  feeQuoter: PublicKey
  rmnRemote: PublicKey
  linkTokenMint: PublicKey
  feeAggregator: PublicKey
}

export interface ConfigJSON {
  version: number
  defaultCodeVersion: types.CodeVersionJSON
  svmChainSelector: string
  owner: string
  proposedOwner: string
  feeQuoter: string
  rmnRemote: string
  linkTokenMint: string
  feeAggregator: string
}

export class Config {
  readonly version: number
  readonly defaultCodeVersion: types.CodeVersionKind
  readonly svmChainSelector: BN
  readonly owner: PublicKey
  readonly proposedOwner: PublicKey
  readonly feeQuoter: PublicKey
  readonly rmnRemote: PublicKey
  readonly linkTokenMint: PublicKey
  readonly feeAggregator: PublicKey

  static readonly discriminator = Buffer.from([
    155, 12, 170, 224, 30, 250, 204, 130,
  ])

  static readonly layout = borsh.struct([
    borsh.u8("version"),
    types.CodeVersion.layout("defaultCodeVersion"),
    borsh.u64("svmChainSelector"),
    borsh.publicKey("owner"),
    borsh.publicKey("proposedOwner"),
    borsh.publicKey("feeQuoter"),
    borsh.publicKey("rmnRemote"),
    borsh.publicKey("linkTokenMint"),
    borsh.publicKey("feeAggregator"),
  ])

  constructor(fields: ConfigFields) {
    this.version = fields.version
    this.defaultCodeVersion = fields.defaultCodeVersion
    this.svmChainSelector = fields.svmChainSelector
    this.owner = fields.owner
    this.proposedOwner = fields.proposedOwner
    this.feeQuoter = fields.feeQuoter
    this.rmnRemote = fields.rmnRemote
    this.linkTokenMint = fields.linkTokenMint
    this.feeAggregator = fields.feeAggregator
  }

  static async fetch(
    c: Connection,
    address: PublicKey,
    programId: PublicKey = PROGRAM_ID
  ): Promise<Config | null> {
    const info = await c.getAccountInfo(address)

    if (info === null) {
      return null
    }
    if (!info.owner.equals(programId)) {
      throw new Error("account doesn't belong to this program")
    }

    return this.decode(info.data)
  }

  static async fetchMultiple(
    c: Connection,
    addresses: PublicKey[],
    programId: PublicKey = PROGRAM_ID
  ): Promise<Array<Config | null>> {
    const infos = await c.getMultipleAccountsInfo(addresses)

    return infos.map((info) => {
      if (info === null) {
        return null
      }
      if (!info.owner.equals(programId)) {
        throw new Error("account doesn't belong to this program")
      }

      return this.decode(info.data)
    })
  }

  static decode(data: Buffer): Config {
    if (!data.slice(0, 8).equals(Config.discriminator)) {
      throw new Error("invalid account discriminator")
    }

    const dec = Config.layout.decode(data.slice(8))

    return new Config({
      version: dec.version,
      defaultCodeVersion: types.CodeVersion.fromDecoded(dec.defaultCodeVersion),
      svmChainSelector: dec.svmChainSelector,
      owner: dec.owner,
      proposedOwner: dec.proposedOwner,
      feeQuoter: dec.feeQuoter,
      rmnRemote: dec.rmnRemote,
      linkTokenMint: dec.linkTokenMint,
      feeAggregator: dec.feeAggregator,
    })
  }

  toJSON(): ConfigJSON {
    return {
      version: this.version,
      defaultCodeVersion: this.defaultCodeVersion.toJSON(),
      svmChainSelector: this.svmChainSelector.toString(),
      owner: this.owner.toString(),
      proposedOwner: this.proposedOwner.toString(),
      feeQuoter: this.feeQuoter.toString(),
      rmnRemote: this.rmnRemote.toString(),
      linkTokenMint: this.linkTokenMint.toString(),
      feeAggregator: this.feeAggregator.toString(),
    }
  }

  static fromJSON(obj: ConfigJSON): Config {
    return new Config({
      version: obj.version,
      defaultCodeVersion: types.CodeVersion.fromJSON(obj.defaultCodeVersion),
      svmChainSelector: new BN(obj.svmChainSelector),
      owner: new PublicKey(obj.owner),
      proposedOwner: new PublicKey(obj.proposedOwner),
      feeQuoter: new PublicKey(obj.feeQuoter),
      rmnRemote: new PublicKey(obj.rmnRemote),
      linkTokenMint: new PublicKey(obj.linkTokenMint),
      feeAggregator: new PublicKey(obj.feeAggregator),
    })
  }
}
