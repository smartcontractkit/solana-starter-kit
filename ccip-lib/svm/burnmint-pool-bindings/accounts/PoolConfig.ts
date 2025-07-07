import { PublicKey, Connection } from "@solana/web3.js"
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface PoolConfigFields {
  version: number
  selfServedAllowed: boolean
  router: PublicKey
  rmnRemote: PublicKey
}

export interface PoolConfigJSON {
  version: number
  selfServedAllowed: boolean
  router: string
  rmnRemote: string
}

export class PoolConfig {
  readonly version: number
  readonly selfServedAllowed: boolean
  readonly router: PublicKey
  readonly rmnRemote: PublicKey

  static readonly discriminator = Buffer.from([
    26, 108, 14, 123, 116, 230, 129, 43,
  ])

  static readonly layout = borsh.struct([
    borsh.u8("version"),
    borsh.bool("selfServedAllowed"),
    borsh.publicKey("router"),
    borsh.publicKey("rmnRemote"),
  ])

  constructor(fields: PoolConfigFields) {
    this.version = fields.version
    this.selfServedAllowed = fields.selfServedAllowed
    this.router = fields.router
    this.rmnRemote = fields.rmnRemote
  }

  static async fetch(
    c: Connection,
    address: PublicKey,
    programId: PublicKey = PROGRAM_ID
  ): Promise<PoolConfig | null> {
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
  ): Promise<Array<PoolConfig | null>> {
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

  static decode(data: Buffer): PoolConfig {
    if (!data.slice(0, 8).equals(PoolConfig.discriminator)) {
      throw new Error("invalid account discriminator")
    }

    const dec = PoolConfig.layout.decode(data.slice(8))

    return new PoolConfig({
      version: dec.version,
      selfServedAllowed: dec.selfServedAllowed,
      router: dec.router,
      rmnRemote: dec.rmnRemote,
    })
  }

  toJSON(): PoolConfigJSON {
    return {
      version: this.version,
      selfServedAllowed: this.selfServedAllowed,
      router: this.router.toString(),
      rmnRemote: this.rmnRemote.toString(),
    }
  }

  static fromJSON(obj: PoolConfigJSON): PoolConfig {
    return new PoolConfig({
      version: obj.version,
      selfServedAllowed: obj.selfServedAllowed,
      router: new PublicKey(obj.router),
      rmnRemote: new PublicKey(obj.rmnRemote),
    })
  }
}
