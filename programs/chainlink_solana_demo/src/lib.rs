use anchor_lang::prelude::*;

use chainlink_solana as chainlink;

declare_id!("CnrgKig7fjYfWkxNVWkNwNMziuarP1Aiu7MkJuXRWEY5");

#[program]
pub mod chainlink_solana_demo {

    use chainlink_solana::v2::read_feed_v2;

    use super::*;
    pub fn execute(
        ctx: Context<Execute>
    ) -> Result<()> {
        let feed = &ctx.accounts.chainlink_feed;
        let result = read_feed_v2(
            feed.try_borrow_data()?, 
            feed.owner.to_bytes()
        ).map_err(|_| DemoError::ReadError)?;

        let round = result.latest_round_data().ok_or(DemoError::RoundDataMissing)?;
        
        let description = result.description();
        let decimals = result.decimals();

        let decimal: &mut Account<Decimal> = &mut ctx.accounts.decimal;
        decimal.value = round.answer;
        decimal.decimals = u32::from(decimals);

        let decimal_print: Decimal = Decimal::new(round.answer, u32::from(result.decimals()));
        msg!("price is {}", decimal_print);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Execute<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = 100,
    )]
    pub decimal: Account<'info, Decimal>,

    /// CHECK: We're reading data from this specified chainlink feed
    pub chainlink_feed: AccountInfo<'info>,
    /// CHECK: This is the devnet system program
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Decimal {
    pub value: i128,
    pub decimals: u32,
}

impl Decimal {
    pub fn new(value: i128, decimals: u32) -> Self {
        Decimal {value, decimals}
    }
}

impl std::fmt::Display for Decimal {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut scaled_val = self.value.to_string();
        if scaled_val.len() <= self.decimals as usize {
            scaled_val.insert_str(
                0,
                &vec!["0"; self.decimals as usize - scaled_val.len()].join("")
            );
            scaled_val.insert_str(0, "0.")
        } else {
            scaled_val.insert(scaled_val.len() - self.decimals as usize, '.');
        }
        f.write_str(&scaled_val)
    }
}

#[error_code]
pub enum DemoError {
    #[msg("read error")]
    ReadError,
    #[msg("no round data")]
    RoundDataMissing,
}