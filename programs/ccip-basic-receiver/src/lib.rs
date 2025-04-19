use anchor_lang::prelude::*;

declare_id!("671b2A65jR5QxwYFSuEMBhQ6bWJKkGMheEp3ReWC9WnB");

#[program]
pub mod ccip_basic_receiver {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
