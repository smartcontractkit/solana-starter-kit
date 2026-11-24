use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_lang::Discriminator;
use anchor_spl::associated_token::get_associated_token_address_with_program_id;
use ccip_common::messages::NormalizeWsol;
use ccip_common::{resolution::*, seed};

use crate::error::SenderError;
use crate::instruction as sender_instruction;
use crate::state::CCIP_SENDER;

use super::common::*;
use super::ResolveAccountsStart;

/// First resolution round: every account `ccip_send` reads for itself.
///
/// The router's list follows it, produced by the nested rounds.
pub fn start(
    ctx: Context<ResolveAccountsStart>,
    params: ResolveAccountsParams,
) -> Result<ResolveAccountsResponse> {
    let send_params = parse_send_params(&params.ix_data)?;

    require_chain_config(
        ctx.accounts.chain_config.key(),
        send_params.dest_chain_selector,
    )?;
    require_keys_eq!(
        ctx.accounts.router.key(),
        ctx.accounts.state.router,
        SenderError::InvalidRouter
    );
    require_keys_eq!(
        ctx.accounts.router_config.key(),
        find(&[seed::CONFIG], ctx.accounts.state.router),
        SenderError::InvalidRouterConfig
    );
    require_keys_eq!(
        ctx.accounts.fee_token_mint.key(),
        send_params.fee_token.normalize_wsol(),
        SenderError::InvalidFeeTokenAccount
    );

    let ccip_sender = find(&[CCIP_SENDER], crate::ID);

    let fee_token_program = *ctx.accounts.fee_token_mint.owner;

    let ccip_sender_fee_token_ata = if send_params.fee_token == Pubkey::default() {
        Pubkey::default().readonly()
    } else {
        get_associated_token_address_with_program_id(
            &ccip_sender,
            &ctx.accounts.fee_token_mint.key(),
            &fee_token_program,
        )
        .writable()
    };

    let mut accounts_to_save = vec![
        ctx.accounts.state.key().readonly(),
        ctx.accounts.chain_config.key().readonly(),
        // The send authority: the account whose tokens or lamports are pulled, and the only
        // signer of the resolved instruction.
        params.caller.signer().writable(),
        get_associated_token_address_with_program_id(
            &params.caller,
            &ctx.accounts.fee_token_mint.key(),
            &fee_token_program,
        )
        .writable(),
        ccip_sender.writable(),
        ctx.accounts.router.key().readonly(),
        fee_token_program.readonly(),
        ctx.accounts.fee_token_mint.key().readonly(),
        ccip_sender_fee_token_ata,
        find(&[seed::FEE_BILLING_SIGNER], ctx.accounts.router.key()).readonly(),
        system_program::ID.readonly(),
        // #[event_cpi]
        find(&[seed::EVENT_AUTHORITY], crate::ID).readonly(),
        crate::ID.readonly(),
    ];

    if let Some(token_amount) = send_params.token_amount.as_ref() {
        let mint = ctx
            .remaining_accounts
            .first()
            .ok_or(SenderError::MissingTransferTokenMint)?;
        require_keys_eq!(
            mint.key(),
            token_amount.token,
            SenderError::MissingTransferTokenMint
        );
        let token_program = *mint.owner;

        accounts_to_save.extend([
            get_associated_token_address_with_program_id(
                &params.caller,
                &token_amount.token,
                &token_program,
            )
            .writable(),
            get_associated_token_address_with_program_id(
                &ccip_sender,
                &token_amount.token,
                &token_program,
            )
            .writable(),
            token_amount.token.readonly(),
            token_program.readonly(),
        ]);
    }

    let response = ResolveAccountsResponse {
        // What [`super::forward_router_stage`] needs, plus the single account the router's own
        // entrypoint takes.
        ask_again_with: vec![
            ctx.accounts.chain_config.key(),
            ctx.accounts.router.key(),
            ctx.accounts.router_config.key(),
        ],
        accounts_to_save,
        // This program returns no lookup table of its own: only the router's and the token pools'
        // tables come back from the later rounds, so the accounts above are static keys in the
        // caller's transaction. That fits most messages, but the larger token paths (CCTP) exceed
        // the 1232-byte transaction limit.
        //
        // A production sender should return a lookup table here holding its fixed accounts:
        // `state`, `ccip_sender`, the event authority, one `chain_config` per destination and
        // `ccip_sender`'s token account per mint. The admin creates it and extends it whenever a
        // chain or mint is added, as the router does with its onramp table. The caller's own
        // accounts stay out of it, so callers need no lookup table setup of their own.
        lookup_tables_to_save: vec![],
        next_ix_discriminator: Some(
            sender_instruction::ResolveAccountsForwardRouterStage::DISCRIMINATOR
                .try_into()
                .unwrap(),
        ),
        metadata: serialize_metadata(&SenderResolutionMetadata {
            router_ix_discriminator: resolve_accounts_start_discriminator(),
            router_metadata: vec![],
        })?,
    };

    require_response_fits(&response)?;
    Ok(response)
}
