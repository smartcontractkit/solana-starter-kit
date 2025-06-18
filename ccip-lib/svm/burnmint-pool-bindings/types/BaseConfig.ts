import { PublicKey } from "@solana/web3.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types" // eslint-disable-line @typescript-eslint/no-unused-vars
import * as borsh from "@coral-xyz/borsh"

export interface BaseConfigFields {
  token_program: PublicKey
  mint: PublicKey
  decimals: number
  pool_signer: PublicKey
  pool_token_account: PublicKey
  owner: PublicKey
  proposed_owner: PublicKey
  rate_limit_admin: PublicKey
  router_onramp_authority: PublicKey
  router: PublicKey
  rebalancer: PublicKey
  can_accept_liquidity: boolean
  list_enabled: boolean
  allow_list: Array<PublicKey>
  rmn_remote: PublicKey
}

export interface BaseConfigJSON {
  token_program: string
  mint: string
  decimals: number
  pool_signer: string
  pool_token_account: string
  owner: string
  proposed_owner: string
  rate_limit_admin: string
  router_onramp_authority: string
  router: string
  rebalancer: string
  can_accept_liquidity: boolean
  list_enabled: boolean
  allow_list: Array<string>
  rmn_remote: string
}

export class BaseConfig {
  readonly token_program: PublicKey
  readonly mint: PublicKey
  readonly decimals: number
  readonly pool_signer: PublicKey
  readonly pool_token_account: PublicKey
  readonly owner: PublicKey
  readonly proposed_owner: PublicKey
  readonly rate_limit_admin: PublicKey
  readonly router_onramp_authority: PublicKey
  readonly router: PublicKey
  readonly rebalancer: PublicKey
  readonly can_accept_liquidity: boolean
  readonly list_enabled: boolean
  readonly allow_list: Array<PublicKey>
  readonly rmn_remote: PublicKey

  constructor(fields: BaseConfigFields) {
    this.token_program = fields.token_program
    this.mint = fields.mint
    this.decimals = fields.decimals
    this.pool_signer = fields.pool_signer
    this.pool_token_account = fields.pool_token_account
    this.owner = fields.owner
    this.proposed_owner = fields.proposed_owner
    this.rate_limit_admin = fields.rate_limit_admin
    this.router_onramp_authority = fields.router_onramp_authority
    this.router = fields.router
    this.rebalancer = fields.rebalancer
    this.can_accept_liquidity = fields.can_accept_liquidity
    this.list_enabled = fields.list_enabled
    this.allow_list = fields.allow_list
    this.rmn_remote = fields.rmn_remote
  }

  static layout(property?: string) {
    return borsh.struct(
      [
        borsh.publicKey("token_program"),
        borsh.publicKey("mint"),
        borsh.u8("decimals"),
        borsh.publicKey("pool_signer"),
        borsh.publicKey("pool_token_account"),
        borsh.publicKey("owner"),
        borsh.publicKey("proposed_owner"),
        borsh.publicKey("rate_limit_admin"),
        borsh.publicKey("router_onramp_authority"),
        borsh.publicKey("router"),
        borsh.publicKey("rebalancer"),
        borsh.bool("can_accept_liquidity"),
        borsh.bool("list_enabled"),
        borsh.vec(borsh.publicKey(), "allow_list"),
        borsh.publicKey("rmn_remote"),
      ],
      property
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromDecoded(obj: any) {
    return new BaseConfig({
      token_program: new PublicKey(obj.token_program),
      mint: new PublicKey(obj.mint),
      decimals: obj.decimals,
      pool_signer: new PublicKey(obj.pool_signer),
      pool_token_account: new PublicKey(obj.pool_token_account),
      owner: new PublicKey(obj.owner),
      proposed_owner: new PublicKey(obj.proposed_owner),
      rate_limit_admin: new PublicKey(obj.rate_limit_admin),
      router_onramp_authority: new PublicKey(obj.router_onramp_authority),
      router: new PublicKey(obj.router),
      rebalancer: new PublicKey(obj.rebalancer),
      can_accept_liquidity: obj.can_accept_liquidity,
      list_enabled: obj.list_enabled,
      allow_list: obj.allow_list.map(
        (
          item: any /* eslint-disable-line @typescript-eslint/no-explicit-any */
        ) => new PublicKey(item)
      ),
      rmn_remote: new PublicKey(obj.rmn_remote),
    })
  }

  static toEncodable(fields: BaseConfigFields) {
    return {
      token_program: fields.token_program,
      mint: fields.mint,
      decimals: fields.decimals,
      pool_signer: fields.pool_signer,
      pool_token_account: fields.pool_token_account,
      owner: fields.owner,
      proposed_owner: fields.proposed_owner,
      rate_limit_admin: fields.rate_limit_admin,
      router_onramp_authority: fields.router_onramp_authority,
      router: fields.router,
      rebalancer: fields.rebalancer,
      can_accept_liquidity: fields.can_accept_liquidity,
      list_enabled: fields.list_enabled,
      allow_list: fields.allow_list,
      rmn_remote: fields.rmn_remote,
    }
  }

  toJSON(): BaseConfigJSON {
    return {
      token_program: this.token_program.toString(),
      mint: this.mint.toString(),
      decimals: this.decimals,
      pool_signer: this.pool_signer.toString(),
      pool_token_account: this.pool_token_account.toString(),
      owner: this.owner.toString(),
      proposed_owner: this.proposed_owner.toString(),
      rate_limit_admin: this.rate_limit_admin.toString(),
      router_onramp_authority: this.router_onramp_authority.toString(),
      router: this.router.toString(),
      rebalancer: this.rebalancer.toString(),
      can_accept_liquidity: this.can_accept_liquidity,
      list_enabled: this.list_enabled,
      allow_list: this.allow_list.map((item) => item.toString()),
      rmn_remote: this.rmn_remote.toString(),
    }
  }

  static fromJSON(obj: BaseConfigJSON): BaseConfig {
    return new BaseConfig({
      token_program: new PublicKey(obj.token_program),
      mint: new PublicKey(obj.mint),
      decimals: obj.decimals,
      pool_signer: new PublicKey(obj.pool_signer),
      pool_token_account: new PublicKey(obj.pool_token_account),
      owner: new PublicKey(obj.owner),
      proposed_owner: new PublicKey(obj.proposed_owner),
      rate_limit_admin: new PublicKey(obj.rate_limit_admin),
      router_onramp_authority: new PublicKey(obj.router_onramp_authority),
      router: new PublicKey(obj.router),
      rebalancer: new PublicKey(obj.rebalancer),
      can_accept_liquidity: obj.can_accept_liquidity,
      list_enabled: obj.list_enabled,
      allow_list: obj.allow_list.map((item) => new PublicKey(item)),
      rmn_remote: new PublicKey(obj.rmn_remote),
    })
  }

  toEncodable() {
    return BaseConfig.toEncodable(this)
  }
}
