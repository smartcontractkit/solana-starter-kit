export type CustomError =
  | Unauthorized
  | InvalidRMNRemoteAddress
  | InvalidInputsMint
  | InvalidVersion
  | FeeTokenMismatch
  | RedundantOwnerProposal
  | ReachedMaxSequenceNumber
  | InvalidInputsTokenIndices
  | InvalidInputsPoolAccounts
  | InvalidInputsTokenAccounts
  | InvalidInputsTokenAdminRegistryAccounts
  | InvalidInputsLookupTableAccounts
  | InvalidInputsLookupTableAccountWritable
  | InvalidInputsTokenAmount
  | InvalidInputsTransferAllAmount
  | InvalidInputsAtaAddress
  | InvalidInputsAtaWritable
  | InvalidInputsChainSelector
  | InsufficientLamports
  | InsufficientFunds
  | SourceTokenDataTooLarge
  | InvalidTokenAdminRegistryInputsZeroAddress
  | InvalidTokenAdminRegistryProposedAdmin
  | SenderNotAllowed
  | InvalidCodeVersion
  | InvalidCcipVersionRollback

export class Unauthorized extends Error {
  static readonly code = 7000
  readonly code = 7000
  readonly name = "Unauthorized"
  readonly msg = "The signer is unauthorized"

  constructor(readonly logs?: string[]) {
    super("7000: The signer is unauthorized")
  }
}

export class InvalidRMNRemoteAddress extends Error {
  static readonly code = 7001
  readonly code = 7001
  readonly name = "InvalidRMNRemoteAddress"
  readonly msg = "Invalid RMN Remote Address"

  constructor(readonly logs?: string[]) {
    super("7001: Invalid RMN Remote Address")
  }
}

export class InvalidInputsMint extends Error {
  static readonly code = 7002
  readonly code = 7002
  readonly name = "InvalidInputsMint"
  readonly msg = "Mint account input is invalid"

  constructor(readonly logs?: string[]) {
    super("7002: Mint account input is invalid")
  }
}

export class InvalidVersion extends Error {
  static readonly code = 7003
  readonly code = 7003
  readonly name = "InvalidVersion"
  readonly msg = "Invalid version of the onchain state"

  constructor(readonly logs?: string[]) {
    super("7003: Invalid version of the onchain state")
  }
}

export class FeeTokenMismatch extends Error {
  static readonly code = 7004
  readonly code = 7004
  readonly name = "FeeTokenMismatch"
  readonly msg = "Fee token doesn't match transfer token"

  constructor(readonly logs?: string[]) {
    super("7004: Fee token doesn't match transfer token")
  }
}

export class RedundantOwnerProposal extends Error {
  static readonly code = 7005
  readonly code = 7005
  readonly name = "RedundantOwnerProposal"
  readonly msg = "Proposed owner is the current owner"

  constructor(readonly logs?: string[]) {
    super("7005: Proposed owner is the current owner")
  }
}

export class ReachedMaxSequenceNumber extends Error {
  static readonly code = 7006
  readonly code = 7006
  readonly name = "ReachedMaxSequenceNumber"
  readonly msg = "Reached max sequence number"

  constructor(readonly logs?: string[]) {
    super("7006: Reached max sequence number")
  }
}

export class InvalidInputsTokenIndices extends Error {
  static readonly code = 7007
  readonly code = 7007
  readonly name = "InvalidInputsTokenIndices"
  readonly msg = "Invalid pool account account indices"

  constructor(readonly logs?: string[]) {
    super("7007: Invalid pool account account indices")
  }
}

export class InvalidInputsPoolAccounts extends Error {
  static readonly code = 7008
  readonly code = 7008
  readonly name = "InvalidInputsPoolAccounts"
  readonly msg = "Invalid pool accounts"

  constructor(readonly logs?: string[]) {
    super("7008: Invalid pool accounts")
  }
}

export class InvalidInputsTokenAccounts extends Error {
  static readonly code = 7009
  readonly code = 7009
  readonly name = "InvalidInputsTokenAccounts"
  readonly msg = "Invalid token accounts"

  constructor(readonly logs?: string[]) {
    super("7009: Invalid token accounts")
  }
}

export class InvalidInputsTokenAdminRegistryAccounts extends Error {
  static readonly code = 7010
  readonly code = 7010
  readonly name = "InvalidInputsTokenAdminRegistryAccounts"
  readonly msg = "Invalid Token Admin Registry account"

  constructor(readonly logs?: string[]) {
    super("7010: Invalid Token Admin Registry account")
  }
}

export class InvalidInputsLookupTableAccounts extends Error {
  static readonly code = 7011
  readonly code = 7011
  readonly name = "InvalidInputsLookupTableAccounts"
  readonly msg = "Invalid LookupTable account"

  constructor(readonly logs?: string[]) {
    super("7011: Invalid LookupTable account")
  }
}

export class InvalidInputsLookupTableAccountWritable extends Error {
  static readonly code = 7012
  readonly code = 7012
  readonly name = "InvalidInputsLookupTableAccountWritable"
  readonly msg = "Invalid LookupTable account writable access"

  constructor(readonly logs?: string[]) {
    super("7012: Invalid LookupTable account writable access")
  }
}

export class InvalidInputsTokenAmount extends Error {
  static readonly code = 7013
  readonly code = 7013
  readonly name = "InvalidInputsTokenAmount"
  readonly msg = "Cannot send zero tokens"

  constructor(readonly logs?: string[]) {
    super("7013: Cannot send zero tokens")
  }
}

export class InvalidInputsTransferAllAmount extends Error {
  static readonly code = 7014
  readonly code = 7014
  readonly name = "InvalidInputsTransferAllAmount"
  readonly msg = "Must specify zero amount to send alongside transfer_all"

  constructor(readonly logs?: string[]) {
    super("7014: Must specify zero amount to send alongside transfer_all")
  }
}

export class InvalidInputsAtaAddress extends Error {
  static readonly code = 7015
  readonly code = 7015
  readonly name = "InvalidInputsAtaAddress"
  readonly msg = "Invalid Associated Token Account address"

  constructor(readonly logs?: string[]) {
    super("7015: Invalid Associated Token Account address")
  }
}

export class InvalidInputsAtaWritable extends Error {
  static readonly code = 7016
  readonly code = 7016
  readonly name = "InvalidInputsAtaWritable"
  readonly msg = "Invalid Associated Token Account writable flag"

  constructor(readonly logs?: string[]) {
    super("7016: Invalid Associated Token Account writable flag")
  }
}

export class InvalidInputsChainSelector extends Error {
  static readonly code = 7017
  readonly code = 7017
  readonly name = "InvalidInputsChainSelector"
  readonly msg = "Chain selector is invalid"

  constructor(readonly logs?: string[]) {
    super("7017: Chain selector is invalid")
  }
}

export class InsufficientLamports extends Error {
  static readonly code = 7018
  readonly code = 7018
  readonly name = "InsufficientLamports"
  readonly msg = "Insufficient lamports"

  constructor(readonly logs?: string[]) {
    super("7018: Insufficient lamports")
  }
}

export class InsufficientFunds extends Error {
  static readonly code = 7019
  readonly code = 7019
  readonly name = "InsufficientFunds"
  readonly msg = "Insufficient funds"

  constructor(readonly logs?: string[]) {
    super("7019: Insufficient funds")
  }
}

export class SourceTokenDataTooLarge extends Error {
  static readonly code = 7020
  readonly code = 7020
  readonly name = "SourceTokenDataTooLarge"
  readonly msg = "Source token data is too large"

  constructor(readonly logs?: string[]) {
    super("7020: Source token data is too large")
  }
}

export class InvalidTokenAdminRegistryInputsZeroAddress extends Error {
  static readonly code = 7021
  readonly code = 7021
  readonly name = "InvalidTokenAdminRegistryInputsZeroAddress"
  readonly msg = "New Admin can not be zero address"

  constructor(readonly logs?: string[]) {
    super("7021: New Admin can not be zero address")
  }
}

export class InvalidTokenAdminRegistryProposedAdmin extends Error {
  static readonly code = 7022
  readonly code = 7022
  readonly name = "InvalidTokenAdminRegistryProposedAdmin"
  readonly msg = "An already owned registry can not be proposed"

  constructor(readonly logs?: string[]) {
    super("7022: An already owned registry can not be proposed")
  }
}

export class SenderNotAllowed extends Error {
  static readonly code = 7023
  readonly code = 7023
  readonly name = "SenderNotAllowed"
  readonly msg = "Sender not allowed for that destination chain"

  constructor(readonly logs?: string[]) {
    super("7023: Sender not allowed for that destination chain")
  }
}

export class InvalidCodeVersion extends Error {
  static readonly code = 7024
  readonly code = 7024
  readonly name = "InvalidCodeVersion"
  readonly msg = "Invalid code version"

  constructor(readonly logs?: string[]) {
    super("7024: Invalid code version")
  }
}

export class InvalidCcipVersionRollback extends Error {
  static readonly code = 7025
  readonly code = 7025
  readonly name = "InvalidCcipVersionRollback"
  readonly msg =
    "Invalid rollback attempt on the CCIP version of the onramp to the destination chain"

  constructor(readonly logs?: string[]) {
    super(
      "7025: Invalid rollback attempt on the CCIP version of the onramp to the destination chain"
    )
  }
}

export function fromCode(code: number, logs?: string[]): CustomError | null {
  switch (code) {
    case 7000:
      return new Unauthorized(logs)
    case 7001:
      return new InvalidRMNRemoteAddress(logs)
    case 7002:
      return new InvalidInputsMint(logs)
    case 7003:
      return new InvalidVersion(logs)
    case 7004:
      return new FeeTokenMismatch(logs)
    case 7005:
      return new RedundantOwnerProposal(logs)
    case 7006:
      return new ReachedMaxSequenceNumber(logs)
    case 7007:
      return new InvalidInputsTokenIndices(logs)
    case 7008:
      return new InvalidInputsPoolAccounts(logs)
    case 7009:
      return new InvalidInputsTokenAccounts(logs)
    case 7010:
      return new InvalidInputsTokenAdminRegistryAccounts(logs)
    case 7011:
      return new InvalidInputsLookupTableAccounts(logs)
    case 7012:
      return new InvalidInputsLookupTableAccountWritable(logs)
    case 7013:
      return new InvalidInputsTokenAmount(logs)
    case 7014:
      return new InvalidInputsTransferAllAmount(logs)
    case 7015:
      return new InvalidInputsAtaAddress(logs)
    case 7016:
      return new InvalidInputsAtaWritable(logs)
    case 7017:
      return new InvalidInputsChainSelector(logs)
    case 7018:
      return new InsufficientLamports(logs)
    case 7019:
      return new InsufficientFunds(logs)
    case 7020:
      return new SourceTokenDataTooLarge(logs)
    case 7021:
      return new InvalidTokenAdminRegistryInputsZeroAddress(logs)
    case 7022:
      return new InvalidTokenAdminRegistryProposedAdmin(logs)
    case 7023:
      return new SenderNotAllowed(logs)
    case 7024:
      return new InvalidCodeVersion(logs)
    case 7025:
      return new InvalidCcipVersionRollback(logs)
  }

  return null
}
