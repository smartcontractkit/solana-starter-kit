const anchor = require("@coral-xyz/anchor");
const args = require("minimist")(process.argv.slice(2));

// Set up provider and program
anchor.setProvider(anchor.AnchorProvider.env());
const provider = anchor.getProvider();
const program = anchor.workspace.ChainlinkSolanaDemo;

const CHAINLINK_PROGRAM_ID = "HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny";
const DIVISOR = 100000000;
const DEFAULT_FEED = "99B2bTijsU6f1GCT73HmdR7HCFFjGMBcPZY6jZ96ynrR"; // SOL/USD
const CHAINLINK_FEED = args["feed"] || DEFAULT_FEED;

async function main() {
  console.log(`Interacting with program: ${program.programId}`);

  const priceFeedAccount = anchor.web3.Keypair.generate();
  console.log(`Generated account: ${priceFeedAccount.publicKey}`);

  try {
    // Execute the RPC
    const txSignature = await program.methods
      .execute()
      .accounts({
        decimal: priceFeedAccount.publicKey,
        chainlinkFeed: CHAINLINK_FEED,
        chainlinkProgram: CHAINLINK_PROGRAM_ID,
      })
      .signers([priceFeedAccount])
      .rpc();

    console.log(`Transaction Signature: ${txSignature}`);

    // Fetch and log transaction details
    const txDetails = await provider.connection.getTransaction(txSignature, {
      commitment: "confirmed",
    });

    const txLogs = txDetails?.meta?.logMessages ?? [];
    console.log("Transaction Logs: ", txLogs);

    // Fetch and log price data
    const latestPrice = await program.account.decimal.fetch(
      priceFeedAccount.publicKey
    );

    console.log(`Price: ${latestPrice.value / DIVISOR}`);
  } catch (error) {
    console.error("Error running the program:", error);
  }
}

console.log("Running client...");
main()
  .then(() => console.log("Success"))
  .catch(console.error);
