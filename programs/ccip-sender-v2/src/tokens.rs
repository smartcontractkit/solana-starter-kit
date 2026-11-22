use crate::error::SenderError;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::associated_token::get_associated_token_address_with_program_id;
use anchor_spl::{
    token_2022::spl_token_2022::{
        self,
        instruction::{approve_checked, revoke, transfer_checked},
    },
    token_interface,
};

/// Moves `amount` from the user's ATA into this program's own ATA, then delegates the same amount
/// to the router so it can take possession during message processing.
///
/// Both router-side pulls (the token transfer to the pool and the fee sweep to the fee vault) use
/// the router's `["fee_billing_signer"]` PDA as the transfer authority, so `to_signer` is that PDA
/// in both cases.
#[allow(clippy::too_many_arguments)]
pub fn transfer_to_self_and_approve<'a>(
    token_program: &AccountInfo<'a>,
    token_mint: &AccountInfo<'a>,
    from_ata: &AccountInfo<'a>,
    self_ata: &AccountInfo<'a>,
    self_signer: &AccountInfo<'a>,
    to_signer: &AccountInfo<'a>,
    seeds: &[&[u8]],
    amount: u64,
    decimals: u8,
) -> Result<()> {
    // transfer to this program
    {
        // build transfer from token_2022 SDK, but set expected token program ID
        let mut ix = transfer_checked(
            &spl_token_2022::ID,
            &from_ata.key(),
            &token_mint.key(),
            &self_ata.key(),
            &self_signer.key(),
            &[],
            amount,
            decimals,
        )?;
        ix.program_id = token_program.key(); // allow any custom token program
        invoke_signed(
            &ix,
            &[
                from_ata.clone(),
                token_mint.clone(),
                self_ata.clone(),
                self_signer.clone(),
            ],
            &[seeds],
        )?;
    }

    // approve router to withdraw from this program
    {
        let mut ix = approve_checked(
            &spl_token_2022::ID,
            &self_ata.key(),
            &token_mint.key(),
            &to_signer.key(),
            &self_signer.key(),
            &[],
            amount,
            decimals,
        )?;
        ix.program_id = token_program.key(); // allow any custom token program
        invoke_signed(
            &ix,
            &[
                self_ata.clone(),
                token_mint.clone(),
                to_signer.clone(),
                self_signer.clone(),
            ],
            &[seeds],
        )?;
    }
    Ok(())
}

/// Returns the unspent part of `max_fee` to the caller and drops the delegation that came with it.
///
/// Both are the tail of a `max_fee` send: the router bills the exact quoted fee, so it leaves behind
/// `max_fee - fee` in this program's ATA and the same amount still delegated to the router's billing
/// signer. Revoking rather than re-approving zero keeps the account's delegate slot clear.
#[allow(clippy::too_many_arguments)]
pub fn refund_and_revoke<'a>(
    token_program: &AccountInfo<'a>,
    token_mint: &AccountInfo<'a>,
    self_ata: &AccountInfo<'a>,
    to_ata: &AccountInfo<'a>,
    self_signer: &AccountInfo<'a>,
    seeds: &[&[u8]],
    amount: u64,
    decimals: u8,
) -> Result<()> {
    // As above, both instructions are built against spl-token-2022 and retargeted at whichever
    // token program actually owns the accounts.
    let mut ix = transfer_checked(
        &spl_token_2022::ID,
        &self_ata.key(),
        &token_mint.key(),
        &to_ata.key(),
        &self_signer.key(),
        &[],
        amount,
        decimals,
    )?;
    ix.program_id = token_program.key();
    invoke_signed(
        &ix,
        &[
            self_ata.clone(),
            token_mint.clone(),
            to_ata.clone(),
            self_signer.clone(),
        ],
        &[seeds],
    )?;

    let mut ix = revoke(
        &spl_token_2022::ID,
        &self_ata.key(),
        &self_signer.key(),
        &[],
    )?;
    ix.program_id = token_program.key();
    invoke_signed(&ix, &[self_ata.clone(), self_signer.clone()], &[seeds])?;

    Ok(())
}

/// Reads a token account's balance, for any token program implementing the SPL interface.
pub fn token_account_amount(token_account: &AccountInfo<'_>) -> Result<u64> {
    let data = &mut &token_account.data.borrow()[..];
    Ok(token_interface::TokenAccount::try_deserialize(data)?.amount)
}

/// Reads a mint's decimals, needed by every `*_checked` token instruction.
pub fn mint_decimals(mint: &AccountInfo<'_>) -> Result<u8> {
    let data = &mut &mint.data.borrow()[..];
    Ok(token_interface::Mint::try_deserialize(data)?.decimals)
}

/// Length of the [`TransferTokenAccounts`] block, i.e. how many accounts `ccip_send` takes ahead of
/// the forwarded router list when the message carries a token transfer.
pub const TRANSFER_TOKEN_ACCOUNTS: usize = 4;

/// The accounts `ccip_send` needs in order to move the caller's tokens into this program's own
/// custody and delegate them to the router before the send.
///
/// This program's resolver emits them, in field order, in front of the forwarded router list. All
/// but `source_ata` also appear somewhere in that list, but reading them from here rather than
/// indexing into it is what keeps this program independent of the router's token-transfer layout.
pub struct TransferTokenAccounts<'a> {
    /// The caller's ATA for the transferred token.
    pub source_ata: &'a AccountInfo<'a>,
    /// The `ccip_sender` PDA's ATA - the account the router will pull the transfer from.
    pub self_ata: &'a AccountInfo<'a>,
    pub mint: &'a AccountInfo<'a>,
    pub token_program: &'a AccountInfo<'a>,
    pub decimals: u8,
}

/// Reads the block above out of `ccip_send`'s leading remaining accounts.
///
/// The mint, its token program and `self_ata` are checked here. `source_ata` is checked by the
/// caller against its own signer.
pub fn parse_transfer_token_accounts<'a>(
    accounts: &'a [AccountInfo<'a>],
    mint: Pubkey,
    ccip_sender: Pubkey,
) -> Result<TransferTokenAccounts<'a>> {
    let [source_ata, self_ata, mint_account, token_program] = accounts else {
        return Err(error!(SenderError::InvalidForwardedAccounts));
    };

    require_keys_eq!(
        mint_account.key(),
        mint,
        SenderError::InvalidForwardedAccounts
    );
    require_keys_eq!(
        *mint_account.owner,
        token_program.key(),
        SenderError::InvalidForwardedAccounts
    );
    require_keys_eq!(
        self_ata.key(),
        get_associated_token_address_with_program_id(&ccip_sender, &mint, &token_program.key()),
        SenderError::InvalidCcipSenderAta
    );

    Ok(TransferTokenAccounts {
        source_ata,
        self_ata,
        mint: mint_account,
        token_program,
        decimals: mint_decimals(mint_account)?,
    })
}
