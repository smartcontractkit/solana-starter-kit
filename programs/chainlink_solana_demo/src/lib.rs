use anchor_lang::prelude::*;

use chainlink_solana as chainlink;

declare_id!("5Jd5huCgvvs6hxKPE1EQUnRKUZSFyPZC9iv5Z1H4gmef");

#[program]
pub mod chainlink_solana_demo {

    use chainlink_solana::Round;

    use super::*;
    pub fn execute(
        ctx: Context<Execute>
    ) -> Result<()> {
        let round: Round = chainlink::latest_round_data(
            ctx.accounts.chainlink_program.to_account_info(),
            ctx.accounts.chainlink_feed.to_account_info(),
        )?;

        let description: String = chainlink::description(
            ctx.accounts.chainlink_program.to_account_info(),
            ctx.accounts.chainlink_feed.to_account_info(),
        )?;

        let decimals: u8 = chainlink::decimals(
            ctx.accounts.chainlink_program.to_account_info(), 
            ctx.accounts.chainlink_feed.to_account_info())?;

        let decimal: &mut Account<Decimal> = &mut ctx.accounts.decimal;
        decimal.value = round.answer;
        decimal.decimals = u32::from(decimals);

        let decimal_print: Decimal = Decimal::new(round.answer, u32::from(decimals));
        msg!("{} price is {}", description, decimal_print);
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
    /// CHECK: This is the Chainlink program library on Devnet
    pub chainlink_program: AccountInfo<'info>,
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
        if self.decimals == 0 {
            // No decimal places, just return the value as-is
            return write!(f, "{}", self.value);
        }

        let is_negative = self.value < 0;
        let mut scaled_val = self.value.abs().to_string();
        
        if scaled_val.len() <= self.decimals as usize {
            // Value is smaller than decimal places, need leading zeros
            let zeros_needed = self.decimals as usize - scaled_val.len();
            scaled_val.insert_str(0, &"0".repeat(zeros_needed));
            scaled_val.insert_str(0, "0.");
        } else {
            // Insert decimal point at the right position
            scaled_val.insert(scaled_val.len() - self.decimals as usize, '.');
        }
        
        if is_negative {
            scaled_val.insert_str(0, "-");
        }
        
        f.write_str(&scaled_val)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decimal_new() {
        let decimal = Decimal::new(12345, 2);
        assert_eq!(decimal.value, 12345);
        assert_eq!(decimal.decimals, 2);
    }

    #[test]
    fn test_decimal_display_basic() {
        let decimal = Decimal::new(12345, 2);
        assert_eq!(format!("{}", decimal), "123.45");
    }

    #[test]
    fn test_decimal_display_zero_value() {
        let decimal = Decimal::new(0, 2);
        assert_eq!(format!("{}", decimal), "0.00");
    }

    #[test]
    fn test_decimal_display_zero_decimals() {
        let decimal = Decimal::new(12345, 0);
        assert_eq!(format!("{}", decimal), "12345");
    }

    #[test]
    fn test_decimal_display_small_value() {
        // Value smaller than decimal places
        let decimal = Decimal::new(5, 3);
        assert_eq!(format!("{}", decimal), "0.005");
    }

    #[test]
    fn test_decimal_display_very_small_value() {
        // Value much smaller than decimal places
        let decimal = Decimal::new(1, 8);
        assert_eq!(format!("{}", decimal), "0.00000001");
    }

    #[test]
    fn test_decimal_display_large_value() {
        let decimal = Decimal::new(1234567890, 8);
        assert_eq!(format!("{}", decimal), "12.34567890");
    }

    #[test]
    fn test_decimal_display_single_digit() {
        let decimal = Decimal::new(5, 1);
        assert_eq!(format!("{}", decimal), "0.5");
    }

    #[test]
    fn test_decimal_display_exact_decimal_places() {
        // Value length equals decimal places
        let decimal = Decimal::new(123, 3);
        assert_eq!(format!("{}", decimal), "0.123");
    }

    #[test]
    fn test_decimal_display_chainlink_sol_usd_example() {
        // Typical SOL/USD price: $105.52 with 8 decimals
        let decimal = Decimal::new(10552000000, 8);
        assert_eq!(format!("{}", decimal), "105.52000000");
    }

    #[test]
    fn test_decimal_display_chainlink_eth_usd_example() {
        // Typical ETH/USD price: $2997.12 with 8 decimals  
        let decimal = Decimal::new(299712000000, 8);
        assert_eq!(format!("{}", decimal), "2997.12000000");
    }

    #[test]
    fn test_decimal_display_btc_usd_example() {
        // Typical BTC/USD price: $43,567.89 with 8 decimals
        let decimal = Decimal::new(4356789000000, 8);
        assert_eq!(format!("{}", decimal), "43567.89000000");
    }

    #[test]
    fn test_decimal_display_micro_price() {
        // Very small crypto price with high precision
        let decimal = Decimal::new(123, 18);
        assert_eq!(format!("{}", decimal), "0.000000000000000123");
    }

    #[test]
    fn test_decimal_struct_size() {
        // Verify our account space allocation is sufficient
        // i128 (16 bytes) + u32 (4 bytes) with alignment = 32 bytes + discriminator (8 bytes) = 40 bytes
        // Our allocation of 100 bytes should be more than sufficient
        let actual_size = std::mem::size_of::<Decimal>();
        assert!(actual_size <= 40); // Allow for alignment/padding
        assert!(actual_size + 8 <= 100); // Include 8-byte discriminator, total should be under 100
    }

    #[test]
    fn test_decimal_max_values() {
        // Test with maximum i128 value
        let decimal = Decimal::new(i128::MAX, 0);
        let display = format!("{}", decimal);
        assert!(display.len() > 0);
        assert!(!display.contains('.'));
    }

    #[test]
    fn test_decimal_negative_values() {
        // Test with negative values (though Chainlink feeds typically don't have negative prices)
        let decimal = Decimal::new(-12345, 2);
        assert_eq!(format!("{}", decimal), "-123.45");
    }

    #[test]
    fn test_decimal_negative_small_values() {
        let decimal = Decimal::new(-5, 3);
        assert_eq!(format!("{}", decimal), "-0.005");
    }

    #[test]
    fn test_decimal_high_precision() {
        // Test with 18 decimal places (common in DeFi)
        let decimal = Decimal::new(1000000000000000000, 18);
        assert_eq!(format!("{}", decimal), "1.000000000000000000");
    }

    #[test]
    fn test_decimal_edge_case_single_digit_high_decimals() {
        let decimal = Decimal::new(1, 10);
        assert_eq!(format!("{}", decimal), "0.0000000001");
    }

    #[test]
    fn test_decimal_conversion_from_u8_to_u32() {
        // Test the conversion used in the main function
        let decimals_u8: u8 = 8;
        let decimals_u32 = u32::from(decimals_u8);
        let decimal = Decimal::new(12345678, decimals_u32);
        assert_eq!(decimal.decimals, 8);
        assert_eq!(format!("{}", decimal), "0.12345678");
    }
}