import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface BaseConfigFields {
  tokenProgram: PublicKey
  mint: PublicKey
  decimals: number
  poolSigner: PublicKey
  poolTokenAccount: PublicKey
  owner: PublicKey
  proposedOwner: PublicKey
  rateLimitAdmin: PublicKey
  routerOnrampAuthority: PublicKey
  router: PublicKey
  rebalancer: PublicKey
  canAcceptLiquidity: boolean
  listEnabled: boolean
  allowList: Array<PublicKey>
  rmnRemote: PublicKey
}

export interface BaseConfigJSON {
  tokenProgram: string
  mint: string
  decimals: number
  poolSigner: string
  poolTokenAccount: string
  owner: string
  proposedOwner: string
  rateLimitAdmin: string
  routerOnrampAuthority: string
  router: string
  rebalancer: string
  canAcceptLiquidity: boolean
  listEnabled: boolean
  allowList: Array<string>
  rmnRemote: string
}

export class BaseConfig {
  readonly tokenProgram: PublicKey
  readonly mint: PublicKey
  readonly decimals: number
  readonly poolSigner: PublicKey
  readonly poolTokenAccount: PublicKey
  readonly owner: PublicKey
  readonly proposedOwner: PublicKey
  readonly rateLimitAdmin: PublicKey
  readonly routerOnrampAuthority: PublicKey
  readonly router: PublicKey
  readonly rebalancer: PublicKey
  readonly canAcceptLiquidity: boolean
  readonly listEnabled: boolean
  readonly allowList: Array<PublicKey>
  readonly rmnRemote: PublicKey

  constructor(fields: BaseConfigFields) {
    this.tokenProgram = fields.tokenProgram
    this.mint = fields.mint
    this.decimals = fields.decimals
    this.poolSigner = fields.poolSigner
    this.poolTokenAccount = fields.poolTokenAccount
    this.owner = fields.owner
    this.proposedOwner = fields.proposedOwner
    this.rateLimitAdmin = fields.rateLimitAdmin
    this.routerOnrampAuthority = fields.routerOnrampAuthority
    this.router = fields.router
    this.rebalancer = fields.rebalancer
    this.canAcceptLiquidity = fields.canAcceptLiquidity
    this.listEnabled = fields.listEnabled
    this.allowList = fields.allowList
    this.rmnRemote = fields.rmnRemote
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        borsh.publicKey("tokenProgram"),
        borsh.publicKey("mint"),
        borsh.u8("decimals"),
        borsh.publicKey("poolSigner"),
        borsh.publicKey("poolTokenAccount"),
        borsh.publicKey("owner"),
        borsh.publicKey("proposedOwner"),
        borsh.publicKey("rateLimitAdmin"),
        borsh.publicKey("routerOnrampAuthority"),
        borsh.publicKey("router"),
        borsh.publicKey("rebalancer"),
        borsh.bool("canAcceptLiquidity"),
        borsh.bool("listEnabled"),
        borsh.vec(borsh.publicKey(), "allowList"),
        borsh.publicKey("rmnRemote"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new BaseConfig({
      tokenProgram: obj.tokenProgram,
      mint: obj.mint,
      decimals: obj.decimals,
      poolSigner: obj.poolSigner,
      poolTokenAccount: obj.poolTokenAccount,
      owner: obj.owner,
      proposedOwner: obj.proposedOwner,
      rateLimitAdmin: obj.rateLimitAdmin,
      routerOnrampAuthority: obj.routerOnrampAuthority,
      router: obj.router,
      rebalancer: obj.rebalancer,
      canAcceptLiquidity: obj.canAcceptLiquidity,
      listEnabled: obj.listEnabled,
      allowList: obj.allowList,
      rmnRemote: obj.rmnRemote,
    })
  }

  static toEncodable(fields: BaseConfigFields) {
    return {
      tokenProgram: fields.tokenProgram,
      mint: fields.mint,
      decimals: fields.decimals,
      poolSigner: fields.poolSigner,
      poolTokenAccount: fields.poolTokenAccount,
      owner: fields.owner,
      proposedOwner: fields.proposedOwner,
      rateLimitAdmin: fields.rateLimitAdmin,
      routerOnrampAuthority: fields.routerOnrampAuthority,
      router: fields.router,
      rebalancer: fields.rebalancer,
      canAcceptLiquidity: fields.canAcceptLiquidity,
      listEnabled: fields.listEnabled,
      allowList: fields.allowList,
      rmnRemote: fields.rmnRemote,
    }
  }

  toJSON(): BaseConfigJSON {
    return {
      tokenProgram: this.tokenProgram.toString(),
      mint: this.mint.toString(),
      decimals: this.decimals,
      poolSigner: this.poolSigner.toString(),
      poolTokenAccount: this.poolTokenAccount.toString(),
      owner: this.owner.toString(),
      proposedOwner: this.proposedOwner.toString(),
      rateLimitAdmin: this.rateLimitAdmin.toString(),
      routerOnrampAuthority: this.routerOnrampAuthority.toString(),
      router: this.router.toString(),
      rebalancer: this.rebalancer.toString(),
      canAcceptLiquidity: this.canAcceptLiquidity,
      listEnabled: this.listEnabled,
      allowList: this.allowList.map((item) => item.toString()),
      rmnRemote: this.rmnRemote.toString(),
    }
  }

  static fromJSON(obj: BaseConfigJSON): BaseConfig {
    return new BaseConfig({
      tokenProgram: new PublicKey(obj.tokenProgram),
      mint: new PublicKey(obj.mint),
      decimals: obj.decimals,
      poolSigner: new PublicKey(obj.poolSigner),
      poolTokenAccount: new PublicKey(obj.poolTokenAccount),
      owner: new PublicKey(obj.owner),
      proposedOwner: new PublicKey(obj.proposedOwner),
      rateLimitAdmin: new PublicKey(obj.rateLimitAdmin),
      routerOnrampAuthority: new PublicKey(obj.routerOnrampAuthority),
      router: new PublicKey(obj.router),
      rebalancer: new PublicKey(obj.rebalancer),
      canAcceptLiquidity: obj.canAcceptLiquidity,
      listEnabled: obj.listEnabled,
      allowList: obj.allowList.map((item) => new PublicKey(item)),
      rmnRemote: new PublicKey(obj.rmnRemote),
    })
  }

  toEncodable() {
    return BaseConfig.toEncodable(this)
  }
}
