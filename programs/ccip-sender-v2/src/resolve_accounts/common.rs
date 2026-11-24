use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{get_return_data, invoke},
};
use anchor_lang::{Discriminator, InstructionData};
use ccip_common::resolution::*;

use ccip_router::instruction::CcipSendV2 as RouterCcipSendV2;
use ccip_router::CcipSendV2Params;

use crate::error::SenderError;
use crate::instruction as sender_instruction;
use crate::instructions::{outgoing_message, CcipSendParams};
use crate::state::{RemoteChainConfig, CHAIN_CONFIG_SEED};

/// State threaded between this program's resolution rounds.
///
/// Deliberately just the router's cursor: every account the next round needs travels in
/// `ask_again_with` instead, and everything else is rederived from the `ix_data` each round already
/// receives. Metadata shares a 1kB response with a full page of router accounts, so it is the
/// scarcest field in the whole wrapper (see [`wrap_router_response`]).
#[derive(Clone, Debug, Default, AnchorSerialize, AnchorDeserialize)]
pub struct SenderResolutionMetadata {
    /// The router resolution stage to run next.
    pub router_ix_discriminator: [u8; 8],
    /// The router's own metadata for that stage, forwarded verbatim.
    pub router_metadata: Vec<u8>,
}

/// Parses the `ccip_send` params out of the instruction data being resolved.
///
/// Two of those params are not knowable at resolution time and must not be read here:
/// `resolution_metadata` is what resolution is producing, and `max_fee` is a billing bound with no
/// bearing on the account list. Everything else is what the resolved list is derived from.
pub fn parse_send_params(ix_data: &[u8]) -> Result<CcipSendParams> {
    let (discriminator, data) = ix_data
        .split_at_checked(sender_instruction::CcipSend::DISCRIMINATOR.len())
        .ok_or(SenderError::InvalidResolutionInstructionData)?;
    require!(
        discriminator == sender_instruction::CcipSend::DISCRIMINATOR,
        SenderError::InvalidResolutionInstructionData
    );

    CcipSendParams::try_from_slice(data)
        .map_err(|_| SenderError::InvalidResolutionInstructionData.into())
}

/// Checks that the chain config handed to a resolution round is the one `ccip_send` will load.
///
/// Its seeds carry the destination selector, which only becomes known once `ix_data` is parsed, so
/// Anchor cannot constrain it in the context.
pub fn require_chain_config(chain_config: Pubkey, dest_chain_selector: u64) -> Result<()> {
    require_keys_eq!(
        chain_config,
        find(
            &[
                CHAIN_CONFIG_SEED,
                dest_chain_selector.to_le_bytes().as_ref()
            ],
            crate::ID
        ),
        SenderError::InvalidChainConfig
    );
    Ok(())
}

/// The `ccip_send_v2` instruction data the router resolves against, byte for byte what `ccip_send`
/// will hand it. `resolution_metadata` is left empty: it is the output of this whole process, and
/// the router's resolver does not read it.
pub fn router_send_ix_data(params: &CcipSendParams, chain_config: &RemoteChainConfig) -> Vec<u8> {
    RouterCcipSendV2 {
        params: CcipSendV2Params {
            dest_chain_selector: params.dest_chain_selector,
            message: outgoing_message(params, chain_config),
            resolution_metadata: vec![],
        },
    }
    .data()
}

/// Runs one round of the router's own account resolution.
///
/// The router resolves `ccip_send_v2` through the same staged interface this program exposes, so a
/// round is a plain CPI into whichever stage the previous round pointed at, carrying the accounts
/// that round asked for. Resolution is read-only, so every account goes in as a readonly non-signer
/// - including the `caller` this program names, which is passed as a parameter rather than signed.
pub fn invoke_router_resolver<'info>(
    router: &AccountInfo<'info>,
    stage_accounts: &[AccountInfo<'info>],
    ix_discriminator: [u8; 8],
    params: ResolveAccountsParams,
) -> Result<ResolveAccountsResponse> {
    let mut data = Vec::from(ix_discriminator);
    params
        .serialize(&mut data)
        .map_err(|_| SenderError::SerializationFailed)?;

    let ix = Instruction {
        program_id: router.key(),
        accounts: stage_accounts
            .iter()
            .map(|account| AccountMeta::new_readonly(account.key(), false))
            .collect(),
        data,
    };

    let account_infos = std::iter::once(router.clone())
        .chain(stage_accounts.iter().cloned())
        .collect::<Vec<_>>();
    invoke(&ix, &account_infos)?;

    // Same boundary check as any other CPI return value: get_return_data() reports whatever program
    // last set it anywhere in the call tree, and the router's stages CPI into token pools and CCVs.
    let (returning_program, return_data) =
        get_return_data().ok_or(SenderError::MissingCpiReturnData)?;
    require_keys_eq!(
        returning_program,
        router.key(),
        SenderError::InvalidCpiReturnProgram
    );

    ResolveAccountsResponse::try_from_slice(&return_data)
        .map_err(|_| SenderError::InvalidResolutionResponse.into())
}

/// Wraps one router round's response in this program's own.
///
/// The router's accounts are forwarded verbatim behind `prefix`, minus the signer bit on the
/// `ccip_sender` PDA: the router resolves that PDA as the send's authority, but in the final
/// transaction it signs the inner CPI through `invoke_signed`, not the outer instruction.
///
/// While the router has stages left, this points back at [`super::forward_router_stage`] and
/// carries the router's cursor in [`SenderResolutionMetadata`]. Once the router is done its final
/// metadata becomes this response's metadata, which is what `CcipSendParams::resolution_metadata`
/// expects.
pub fn wrap_router_response(
    mut accounts_to_save: Vec<CcipAccountMeta>,
    chain_config: Pubkey,
    router: Pubkey,
    ccip_sender: Pubkey,
    router_response: ResolveAccountsResponse,
) -> Result<ResolveAccountsResponse> {
    let (mut router_accounts, _) =
        normalize_nested_accounts(router_response.accounts_to_save, ccip_sender)?;
    accounts_to_save.append(&mut router_accounts);

    let response = match router_response.next_ix_discriminator {
        Some(router_ix_discriminator) => ResolveAccountsResponse {
            // The two accounts every forwarding round needs, ahead of the router's own handoff.
            ask_again_with: [chain_config, router]
                .into_iter()
                .chain(router_response.ask_again_with)
                .collect(),
            accounts_to_save,
            lookup_tables_to_save: router_response.lookup_tables_to_save,
            next_ix_discriminator: Some(
                sender_instruction::ResolveAccountsForwardRouterStage::DISCRIMINATOR
                    .try_into()
                    .unwrap(),
            ),
            metadata: serialize_metadata(&SenderResolutionMetadata {
                router_ix_discriminator,
                router_metadata: router_response.metadata,
            })?,
        },
        None => ResolveAccountsResponse {
            ask_again_with: vec![],
            accounts_to_save,
            lookup_tables_to_save: router_response.lookup_tables_to_save,
            next_ix_discriminator: None,
            metadata: router_response.metadata,
        },
    };

    // Nothing in the response above is bounded by this program: the accounts, the handoff and the
    // metadata all come out of the router, whose own 1kB budget assumes it is the outermost
    // resolver. Wrapping it spends two extra `ask_again_with` slots and a dozen metadata bytes, so
    // check the assembled result rather than letting it fail as an opaque return-data write.
    require_response_fits(&response)?;
    Ok(response)
}
