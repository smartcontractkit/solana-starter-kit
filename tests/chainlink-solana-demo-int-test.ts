import * as anchor from '@project-serum/anchor';
import * as fs from 'fs';
import { Program, BN } from '@project-serum/anchor';
import { ChainlinkSolanaDemo } from '../target/types/chainlink_solana_demo';
const assert = require("assert");

const CHAINLINK_PROGRAM_ID = "CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT";
// SOL/USD feed account
const CHAINLINK_FEED = "EdWr4ww1Dq82vPe8GFjjcVPo2Qno3Nhn6baCgM3dCy28";

describe('chainlink-solana-demo', () => {
  const provider = anchor.Provider.env();

  // Configure the client to use the local cluster.
  anchor.setProvider(provider);

  it('Query SOL/USD Price Feed!', async () => {

    // Get the generated IDL
    const idl = JSON.parse(
      require("fs").readFileSync("./target/idl/chainlink_solana_demo.json", "utf8")
    );

    // Address of the deployed program.
    const programId = new anchor.web3.PublicKey("JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm");

    // Generate the program client from IDL and program Id.
    const program = new anchor.Program(idl, programId);

    //create an account to store the price data
    const priceFeedAccount = anchor.web3.Keypair.generate();

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

    // Fetch the account details of the account containing the price data
    const latestPrice = await program.account.decimal.fetch(priceFeedAccount.publicKey);
    console.log('Price Is: ' + latestPrice.value)

    // Ensure the price returned is a positive value
    assert.ok(latestPrice.value > 0);

  });
});
