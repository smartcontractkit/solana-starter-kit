// Initialize Anchor and provider
const anchor = require("@coral-xyz/anchor")
anchor.setProvider(anchor.AnchorProvider.env());

const CHAINLINK_PROGRAM_ID = "HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny";
const DIVISOR = 100000000;

// Data feed account address
// Default is ETH / USD
const CHAINLINK_FEED = "669U43LNHx7LsVj95uYksnhXUfWKDsdzVqev3V4Jpw3P"

async function main() {
  // Create program client
  const program = anchor.workspace.ChainlinkSolanaDemo

  //create an account to store the price data
  const priceFeedAccount = anchor.web3.Keypair.generate();
  console.log('priceFeedAccount public key: ' + priceFeedAccount.publicKey);

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
  
  console.log(`Transaction Signature: ${transactionSignature}`)

  // Fetch the account details of the account containing the price data
  const latestPrice = await program.account.decimal.fetch(priceFeedAccount.publicKey);
  console.log('Price Is: ' + latestPrice.value / DIVISOR)
}

console.log("Running client...");
main().then(() => console.log("Success"));
