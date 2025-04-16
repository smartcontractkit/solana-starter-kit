export type CustomError =
  | InvalidSequenceInterval
  | InvalidInputsPoolAccounts
  | InvalidInputsTokenAccounts
  | InvalidInputsTokenAdminRegistryAccounts
  | InvalidInputsLookupTableAccounts
  | InvalidInputsLookupTableAccountWritable
  | InvalidInputsPoolSignerAccounts

export class InvalidSequenceInterval extends Error {
  static readonly code = 10000
  readonly code = 10000
  readonly name = "InvalidSequenceInterval"
  readonly msg = "The given sequence interval is invalid"

  constructor(readonly logs?: string[]) {
    super("10000: The given sequence interval is invalid")
  }
}

export class InvalidInputsPoolAccounts extends Error {
  static readonly code = 10001
  readonly code = 10001
  readonly name = "InvalidInputsPoolAccounts"
  readonly msg = "Invalid pool accounts"

  constructor(readonly logs?: string[]) {
    super("10001: Invalid pool accounts")
  }
}

export class InvalidInputsTokenAccounts extends Error {
  static readonly code = 10002
  readonly code = 10002
  readonly name = "InvalidInputsTokenAccounts"
  readonly msg = "Invalid token accounts"

  constructor(readonly logs?: string[]) {
    super("10002: Invalid token accounts")
  }
}

export class InvalidInputsTokenAdminRegistryAccounts extends Error {
  static readonly code = 10003
  readonly code = 10003
  readonly name = "InvalidInputsTokenAdminRegistryAccounts"
  readonly msg = "Invalid Token Admin Registry account"

  constructor(readonly logs?: string[]) {
    super("10003: Invalid Token Admin Registry account")
  }
}

export class InvalidInputsLookupTableAccounts extends Error {
  static readonly code = 10004
  readonly code = 10004
  readonly name = "InvalidInputsLookupTableAccounts"
  readonly msg = "Invalid LookupTable account"

  constructor(readonly logs?: string[]) {
    super("10004: Invalid LookupTable account")
  }
}

export class InvalidInputsLookupTableAccountWritable extends Error {
  static readonly code = 10005
  readonly code = 10005
  readonly name = "InvalidInputsLookupTableAccountWritable"
  readonly msg = "Invalid LookupTable account writable access"

  constructor(readonly logs?: string[]) {
    super("10005: Invalid LookupTable account writable access")
  }
}

export class InvalidInputsPoolSignerAccounts extends Error {
  static readonly code = 10006
  readonly code = 10006
  readonly name = "InvalidInputsPoolSignerAccounts"
  readonly msg = "Invalid pool signer account"

  constructor(readonly logs?: string[]) {
    super("10006: Invalid pool signer account")
  }
}

export function fromCode(code: number, logs?: string[]): CustomError | null {
  switch (code) {
    case 10000:
      return new InvalidSequenceInterval(logs)
    case 10001:
      return new InvalidInputsPoolAccounts(logs)
    case 10002:
      return new InvalidInputsTokenAccounts(logs)
    case 10003:
      return new InvalidInputsTokenAdminRegistryAccounts(logs)
    case 10004:
      return new InvalidInputsLookupTableAccounts(logs)
    case 10005:
      return new InvalidInputsLookupTableAccountWritable(logs)
    case 10006:
      return new InvalidInputsPoolSignerAccounts(logs)
  }

  return null
}
