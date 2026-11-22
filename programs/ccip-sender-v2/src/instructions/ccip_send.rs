use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::Instruction,
    program::{get_return_data, invoke_signed},
};
use anchor_lang::system_program;
use anchor_lang::InstructionData;
use anchor_spl::associated_token::get_associated_token_address_with_program_id;
use anchor_spl::token_interface::{Mint, TokenInterface};
use ccip_common::messages::NormalizeWsol;
use ccip_common::seed;
use ccip_router::instruction::CcipSendV2 as RouterCcipSendV2;
use ccip_router::messages::{SVM2AnyMessage, SVMTokenAmount};
use ccip_router::CcipSendV2Params;

use crate::error::SenderError;
use crate::state::{
    BaseState, MessageSent, RemoteChainConfig, CCIP_SENDER, CHAIN_CONFIG_SEED, STATE_SEED,
};
use crate::tokens::{
    parse_transfer_token_accounts, refund_and_revoke, token_account_amount,
    transfer_to_self_and_approve, TRANSFER_TOKEN_ACCOUNTS,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CcipSendParams {
    pub dest_chain_selector: u64,
    /// The CCIP 2.0 onramp carries at most one token transfer per message.
    pub token_amount: Option<SVMTokenAmount>,
    pub data: Vec<u8>,
    /// `Pubkey::default()` pays fees in native SOL, deposited by the caller into the `ccip_sender`
    /// PDA for the router to bill.
    pub fee_token: Pubkey,
    /// Upper bound on what the router may bill for this message, in `fee_token` units. The router bills the exact
    /// quoted fee, and the unspent remainder is returned to the caller before the instruction ends.
    ///
    /// A fee above it reverts the send. In native SOL that is `MaxFeeExceeded` when the
    /// `ccip_sender` PDA's own balance covers the excess, and the System Program's insufficient
    /// lamports error otherwise; in a token it is the token program's insufficient funds error.
    ///
    /// To dimension this fee, the caller can call `get_fee_v2` beforehand and add whatever
    /// slippage they want to accept on top.
    pub max_fee: u64,
    /// Opaque blob produced by the router's account resolution, which this program's own
    /// [`resolve_accounts`] returns from its final round alongside the account list.
    pub resolution_metadata: Vec<u8>,
}

/// The message `ccip_send` hands to the router: the caller's params, with the recipient and extra
/// args taken from the destination chain's stored config.
///
/// Shared with the resolver, which rebuilds it to resolve the router's account list.
pub fn outgoing_message(
    params: &CcipSendParams,
    chain_config: &RemoteChainConfig,
) -> SVM2AnyMessage {
    SVM2AnyMessage {
        receiver: chain_config.recipient.clone(),
        data: params.data.clone(),
        token_amounts: params.token_amount.iter().cloned().collect(),
        fee_token: params.fee_token,
        extra_args: chain_config.extra_args_bytes.clone(),
    }
}

/// Sends a CCIP 2.0 message, paying for it out of the caller's tokens. See the entrypoint in
/// `lib.rs` for how the caller is expected to dimension `params.max_fee` and how the unspent
/// remainder gets back to them.
pub fn ccip_send<'info>(
    ctx: Context<'info, CcipSend<'info>>,
    params: CcipSendParams,
) -> Result<()> {
    let message = outgoing_message(&params, &ctx.accounts.chain_config);

    let example_sender_transfer_token_accounts_len = if params.token_amount.is_some() {
        TRANSFER_TOKEN_ACCOUNTS
    } else {
        0
    };
    require_gte!(
        ctx.remaining_accounts.len(),
        example_sender_transfer_token_accounts_len,
        SenderError::InvalidForwardedAccounts
    );
    let (token_accounts, forwarded) = ctx
        .remaining_accounts
        .split_at(example_sender_transfer_token_accounts_len);
    require!(!forwarded.is_empty(), SenderError::InvalidForwardedAccounts);

    let ccip_sender = ctx.accounts.ccip_sender.to_account_info();
    let ccip_sender_key = ccip_sender.key();
    let ccip_sender_bump = ctx.accounts.state.ccip_sender_bump;
    let seeds: &[&[u8]] = &[CCIP_SENDER, std::slice::from_ref(&ccip_sender_bump)];

    let fee_token_program = ctx.accounts.fee_token_program.to_account_info();
    let fee_token_mint = ctx.accounts.fee_token_mint.to_account_info();
    let fee_token_decimals = ctx.accounts.fee_token_mint.decimals;
    let fee_token_user_ata = ctx.accounts.ccip_sender_fee_token_ata.to_account_info();
    let fee_billing_signer = ctx.accounts.fee_billing_signer.to_account_info();

    // Paying in native SOL moves lamports through the PDA directly, with no token accounts
    // involved.
    let paying_fees_in_token = params.fee_token != Pubkey::default();

    // Taken before the caller's native deposit: lamports the PDA already held are never spent on
    // a send, so the router must bill the whole fee out of that deposit.
    let lamports_before = ccip_sender.lamports();

    // Snapshot taken before anything is deposited. The router bills the exact quoted fee out of
    // this account, so whatever it has gained once the send returns is the unspent part of
    // `max_fee`, which is how the billed amount is recovered.
    let fee_ata_balance_before = if paying_fees_in_token {
        Some(token_account_amount(&fee_token_user_ata)?)
    } else {
        None
    };

    // Amount of the transferred token that is also owed as fees, so both can be covered by a
    // single approval: `approve_checked` replaces the delegated amount rather than adding to
    // it, and when the mints match the router pulls both from the same account.
    let mut fee_token_transfer_amount = 0u64;

    if let Some(token_amount) = params.token_amount.as_ref() {
        let accounts =
            parse_transfer_token_accounts(token_accounts, token_amount.token, ccip_sender_key)?;

        require_keys_eq!(
            accounts.source_ata.key(),
            get_associated_token_address_with_program_id(
                &ctx.accounts.authority.key(),
                &token_amount.token,
                &accounts.token_program.key(),
            ),
            SenderError::InvalidSourceTokenAccount
        );

        if paying_fees_in_token && token_amount.token == fee_token_mint.key() {
            // Deferred: handled together with the fee below, in one approval.
            fee_token_transfer_amount = token_amount.amount;
        } else {
            transfer_to_self_and_approve(
                accounts.token_program,
                accounts.mint,
                accounts.source_ata,
                accounts.self_ata,
                &ccip_sender,
                &fee_billing_signer,
                seeds,
                token_amount.amount,
                accounts.decimals,
            )?;
        }
    }

    if paying_fees_in_token {
        require_keys_eq!(
            ctx.accounts.authority_fee_token_ata.key(),
            get_associated_token_address_with_program_id(
                &ctx.accounts.authority.key(),
                &fee_token_mint.key(),
                &fee_token_program.key(),
            ),
            SenderError::InvalidFeeTokenAccount
        );
        require_keys_eq!(
            fee_token_user_ata.key(),
            get_associated_token_address_with_program_id(
                &ccip_sender_key,
                &fee_token_mint.key(),
                &fee_token_program.key(),
            ),
            SenderError::InvalidCcipSenderAta
        );

        let amount = fee_token_transfer_amount
            .checked_add(params.max_fee)
            .ok_or(SenderError::FeeOverflow)?;

        transfer_to_self_and_approve(
            &fee_token_program,
            &fee_token_mint,
            &ctx.accounts.authority_fee_token_ata.to_account_info(),
            &fee_token_user_ata,
            &ccip_sender,
            &fee_billing_signer,
            seeds,
            amount,
            fee_token_decimals,
        )?;
    } else {
        // The router bills native SOL out of the `ccip_sender` PDA, its CPI signer.
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.authority.to_account_info(),
                    to: ccip_sender.clone(),
                },
            ),
            params.max_fee,
        )?;
    }

    let instruction = Instruction {
        program_id: ctx.accounts.router.key(),
        accounts: forwarded
            .iter()
            .map(|acc| account_meta(acc, acc.key() == ccip_sender_key))
            .collect(),
        data: RouterCcipSendV2 {
            params: CcipSendV2Params {
                dest_chain_selector: params.dest_chain_selector,
                message,
                resolution_metadata: params.resolution_metadata,
            },
        }
        .data(),
    };
    invoke_signed(&instruction, forwarded, &[seeds])?;

    let message_id = {
        let (returning_program, data) =
            get_return_data().ok_or(SenderError::MissingCpiReturnData)?;
        require_keys_eq!(
            returning_program,
            ctx.accounts.router.key(),
            SenderError::InvalidCpiReturnProgram,
        );
        <[u8; 32]>::try_from(data.as_slice()).map_err(|_| error!(SenderError::InvalidMessageId))?
    };

    // What the router actually billed, derived from what it moved rather than quoted up front.
    let fee_amount = match fee_ata_balance_before {
        Some(balance_before) => {
            let unspent = token_account_amount(&fee_token_user_ata)?
                .checked_sub(balance_before)
                .ok_or(SenderError::FeeAccountingFailed)?;

            if unspent > 0 {
                // Both the surplus tokens and the leftover delegation belong to the caller.
                refund_and_revoke(
                    &fee_token_program,
                    &fee_token_mint,
                    &fee_token_user_ata,
                    &ctx.accounts.authority_fee_token_ata.to_account_info(),
                    &ccip_sender,
                    seeds,
                    unspent,
                    fee_token_decimals,
                )?;
            }

            params
                .max_fee
                .checked_sub(unspent)
                .ok_or(SenderError::FeeAccountingFailed)?
        }
        None => {
            // `lamports_before` excludes the caller's deposit, so a fee above `max_fee` could only
            // have been billed out of the PDA's own balance, which leaves the difference negative.
            // When that balance cannot cover the excess either, the router's transfer fails first.
            let unspent = ccip_sender
                .lamports()
                .checked_sub(lamports_before)
                .ok_or(SenderError::MaxFeeExceeded)?;

            if unspent > 0 {
                system_program::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.system_program.key(),
                        system_program::Transfer {
                            from: ccip_sender.clone(),
                            to: ctx.accounts.authority.to_account_info(),
                        },
                        &[seeds],
                    ),
                    unspent,
                )?;
            }

            params
                .max_fee
                .checked_sub(unspent)
                .ok_or(SenderError::FeeAccountingFailed)?
        }
    };

    emit_cpi!(MessageSent {
        dest_chain_selector: params.dest_chain_selector,
        fee_token: params.fee_token,
        fee_amount,
        message_id,
    });

    Ok(())
}

/// Accounts for `ccip_send`.
///
/// Every account this program touches itself is named here, except the transferred token's, which
/// only exist for some messages and so form part of the `TransferTokenAccounts` block in front of the
/// forwarded router list (see the module docs on `crate::ccip_send`). Most of them appear in that
/// forwarded list too, but the runtime merges the duplicate keys.
///
/// The router's own accounts are forwarded through `remaining_accounts` and are never read here.
#[event_cpi]
#[derive(Accounts)]
#[instruction(params: CcipSendParams)]
pub struct CcipSend<'info> {
    #[account(
        seeds = [STATE_SEED],
        bump = state.bump,
    )]
    pub state: Account<'info, BaseState>,
    #[account(
        seeds = [CHAIN_CONFIG_SEED, params.dest_chain_selector.to_le_bytes().as_ref()],
        bump = chain_config.bump,
    )]
    pub chain_config: Account<'info, RemoteChainConfig>,
    // PERMISSIONLESS: example program, anyone may send a message through it. This is the account
    // whose tokens are pulled, and it must have delegated them to the `ccip_sender` PDA first. It
    // also pays native SOL fees.
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: the caller's ATA for the fee token, validated by derivation in the handler. It is
    /// intentionally untyped: on the native-SOL fee path there is no fee ATA to pass, so
    /// deserialising it as a token account would fail.
    #[account(mut)]
    pub authority_fee_token_ata: UncheckedAccount<'info>,
    /// CHECK: the PDA that signs the CPI into the router and custodies the tokens while the router
    /// pulls them.
    #[account(
        mut,
        seeds = [CCIP_SENDER],
        bump = state.ccip_sender_bump,
    )]
    pub ccip_sender: UncheckedAccount<'info>,
    /// CHECK: the router this program sends through, i.e. the target of the `ccip_send_v2` CPI.
    #[account(address = state.router @ SenderError::InvalidRouter)]
    pub router: UncheckedAccount<'info>,
    pub fee_token_program: Interface<'info, TokenInterface>,
    /// The mint fees are quoted in. Paying in native SOL still quotes against wrapped SOL, which is
    /// what the router normalizes the zero address to, so this is never the zero address itself.
    #[account(
        owner = fee_token_program.key() @ SenderError::InvalidFeeTokenAccount,
        address = params.fee_token.normalize_wsol() @ SenderError::InvalidFeeTokenAccount,
    )]
    pub fee_token_mint: Box<InterfaceAccount<'info, Mint>>,
    /// CHECK: the `ccip_sender` PDA's ATA for the fee token, which this program funds up to
    /// `max_fee` and the router then bills, validated by derivation in the handler. Untyped because
    /// native SOL passes the zero address here.
    pub ccip_sender_fee_token_ata: UncheckedAccount<'info>,
    /// CHECK: the router's billing signer, delegated the tokens the router pulls.
    #[account(
        seeds = [seed::FEE_BILLING_SIGNER],
        bump,
        seeds::program = state.router,
    )]
    pub fee_billing_signer: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

/// Builds a meta preserving the account's writability.
fn account_meta(account: &AccountInfo<'_>, is_signer: bool) -> AccountMeta {
    AccountMeta {
        pubkey: account.key(),
        is_signer,
        is_writable: account.is_writable,
    }
}
