import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface DefaultJSON {
  kind: "Default"
}

export class Default {
  static readonly discriminator = 0
  static readonly kind = "Default"
  readonly discriminator = 0
  readonly kind = "Default"

  toJSON(): DefaultJSON {
    return {
      kind: "Default",
    }
  }

  toEncodable() {
    return {
      Default: {},
    }
  }
}

export interface V1JSON {
  kind: "V1"
}

export class V1 {
  static readonly discriminator = 1
  static readonly kind = "V1"
  readonly discriminator = 1
  readonly kind = "V1"

  toJSON(): V1JSON {
    return {
      kind: "V1",
    }
  }

  toEncodable() {
    return {
      V1: {},
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromDecoded(obj: any): types.CodeVersionKind {
  if (typeof obj !== "object") {
    throw new Error("Invalid enum object")
  }

  if ("Default" in obj) {
    return new Default()
  }
  if ("V1" in obj) {
    return new V1()
  }

  throw new Error("Invalid enum object")
}

export function fromJSON(obj: types.CodeVersionJSON): types.CodeVersionKind {
  switch (obj.kind) {
    case "Default": {
      return new Default()
    }
    case "V1": {
      return new V1()
    }
  }
}

export function layout(property?: string) {
  const ret = borsh.rustEnum([
    borsh.struct([], "Default"),
    borsh.struct([], "V1"),
  ])
  if (property !== undefined) {
    return ret.replicate(property)
  }
  return ret
}
