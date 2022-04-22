use anchor_lang::prelude::*;

use chainlink_solana as chainlink;

declare_id!("L2ormt7enqtxZQvbWFpEEGhEN6MLBNZsLheNQdzWuxX");

#[account]
pub struct Decimal {
    pub value: i128,
    pub decimals: u32,
}

impl Decimal {
    pub fn new(value: i128, decimals: u32) -> Self {
        Decimal { value, decimals }
    }
}

impl std::fmt::Display for Decimal {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut scaled_val = self.value.to_string();
        if scaled_val.len() <= self.decimals as usize {
            scaled_val.insert_str(
                0,
                &vec!["0"; self.decimals as usize - scaled_val.len()].join(""),
            );
            scaled_val.insert_str(0, "0.");
        } else {
            scaled_val.insert(scaled_val.len() - self.decimals as usize, '.');
        }
        f.write_str(&scaled_val)
    }
}

#[program]
pub mod chainlink_solana_demo {
    use super::*;
        pub fn execute(ctx: Context<Execute>) -> ProgramResult  {
        let round = chainlink::latest_round_data(
            ctx.accounts.chainlink_program.to_account_info(),
            ctx.accounts.chainlink_feed.to_account_info(),
        )?;

        let description = chainlink::description(
            ctx.accounts.chainlink_program.to_account_info(),
            ctx.accounts.chainlink_feed.to_account_info(),
        )?;

        let decimals = chainlink::decimals(
            ctx.accounts.chainlink_program.to_account_info(),
            ctx.accounts.chainlink_feed.to_account_info(),
        )?;

        // Set the account value
        let decimal: &mut Account<Decimal> = &mut ctx.accounts.decimal;
        decimal.value=round.answer;
        decimal.decimals=u32::from(decimals);

        // Also print the value to the program output
        let decimal_print = Decimal::new(round.answer, u32::from(decimals));
        msg!("{} price is {}", description, decimal_print);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(init, payer = user, space = 100)]
    pub decimal: Account<'info, Decimal>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: We're reading data from this specified chainlink feed
    pub chainlink_feed: AccountInfo<'info>,
    /// CHECK: This is the Chainlink program library on Devnet
    pub chainlink_program: AccountInfo<'info>,
    /// CHECK: This is the devnet system program
    pub system_program: Program<'info, System>,
}
