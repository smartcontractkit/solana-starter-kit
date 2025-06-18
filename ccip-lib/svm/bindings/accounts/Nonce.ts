import { PublicKey, Connection } from "@solana/web3.js"
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import { PROGRAM_ID } from "../programId"

export interface NonceFields {
  version: number
  counter: BN
}

export interface NonceJSON {
  version: number
  counter: string
}

export class Nonce {
  readonly version: number
  readonly counter: BN

  static readonly discriminator = Buffer.from([
    143, 197, 147, 95, 106, 165, 50, 43,
  ])

  static readonly layout = borsh.struct([
    borsh.u8("version"),
    borsh.u64("counter"),
  ])

  constructor(fields: NonceFields) {
    this.version = fields.version
    this.counter = fields.counter
  }

  static async fetch(
    c: Connection,
    address: PublicKey,
    programId: PublicKey = PROGRAM_ID
  ): Promise<Nonce | null> {
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
  ): Promise<Array<Nonce | null>> {
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

  static decode(data: Buffer): Nonce {
    if (!data.slice(0, 8).equals(Nonce.discriminator)) {
      throw new Error("invalid account discriminator")
    }

    const dec = Nonce.layout.decode(data.slice(8))

    return new Nonce({
      version: dec.version,
      counter: dec.counter,
    })
  }

  toJSON(): NonceJSON {
    return {
      version: this.version,
      counter: this.counter.toString(),
    }
  }

  static fromJSON(obj: NonceJSON): Nonce {
    return new Nonce({
      version: obj.version,
      counter: new BN(obj.counter),
    })
  }
}
