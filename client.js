// Parse arguments
// --program - [Required] The account address for your deployed program.
// --feed - The account address for the Chainlink data feed to retrieve
const args = require('minimist')(process.argv.slice(2));

// Initialize Anchor and provider
const anchor = require("@project-serum/anchor");
const provider = anchor.Provider.env();
// Configure the cluster.
anchor.setProvider(provider);

const CHAINLINK_PROGRAM_ID = "HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny";
const DIVISOR = 100000000;

// Data feed account address
// Default is SOL / USD
const default_feed = "HgTtcbcmp5BeThax5AU8vg4VwK79qAvAKKFMs8txMLW6";
const CHAINLINK_FEED = args['feed'] || default_feed;

async function main() {
  // Read the generated IDL.
  const idl = JSON.parse(
    require("fs").readFileSync("./target/idl/chainlink_solana_demo.json", "utf8")
  );

  // Address of the deployed program.
  const programId = new anchor.web3.PublicKey(args['program']);

  // Generate the program client from IDL.
  const program = new anchor.Program(idl, programId);

  //create an account to store the price data
  const priceFeedAccount = anchor.web3.Keypair.generate();

  console.log('priceFeedAccount public key: ' + priceFeedAccount.publicKey);
  console.log('user public key: ' + provider.wallet.publicKey);

  // Execute the RPC.
  let tx = await program.rpc.execute({
    accounts: {
      decimal: priceFeedAccount.publicKey,
      user: provider.wallet.publicKey,
      chainlinkFeed: CHAINLINK_FEED,
      chainlinkProgram: CHAINLINK_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId
    },
    options: { commitment: "confirmed" },
    signers: [priceFeedAccount],
  });

  console.log("Fetching transaction logs...");
  let t = await provider.connection.getConfirmedTransaction(tx, "confirmed");
  console.log(t.meta.logMessages);
  // #endregion main

  // Fetch the account details of the account containing the price data
  const latestPrice = await program.account.decimal.fetch(priceFeedAccount.publicKey);
  console.log('Price Is: ' + latestPrice.value / DIVISOR)
}

console.log("Running client...");
main().then(() => console.log("Success"));
