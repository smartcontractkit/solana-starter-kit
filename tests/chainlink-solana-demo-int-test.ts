import * as anchor from '@coral-xyz/anchor';
const assert = require("assert");

const CHAINLINK_PROGRAM_ID = "HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny";
// SOL/USD feed account
const CHAINLINK_FEED = "669U43LNHx7LsVj95uYksnhXUfWKDsdzVqev3V4Jpw3P";
const DIVISOR = 100000000;

describe('chainlink-solana-demo', () => {

  it('Query SOL/USD Price Feed!', async () => {
    anchor.setProvider(anchor.AnchorProvider.env());

    // Generate the program client from the saved workspace
    const program = anchor.workspace.ChainlinkSolanaDemo;

    //create an account to store the price data
    const priceFeedAccount = anchor.web3.Keypair.generate();

    // Execute the RPC.
    let transactionSignature = await program.methods
      .execute()
      .accounts({
        decimal: priceFeedAccount.publicKey,
        chainlinkFeed: CHAINLINK_FEED,
        chainlinkProgram: CHAINLINK_PROGRAM_ID,
      })
      .signers([priceFeedAccount])
      .rpc()

    // Fetch the account details of the account containing the price data
    const latestPrice = await program.account.decimal.fetch(priceFeedAccount.publicKey);
    console.log('Price Is: ' + latestPrice.value / DIVISOR)

    // Ensure the price returned is a positive value
    assert.ok(latestPrice.value / DIVISOR > 0);

  });
});
