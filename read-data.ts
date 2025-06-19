import * as anchor from "@coral-xyz/anchor";
import { OCR2Feed } from "@chainlink/solana-sdk";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const CHAINLINK_FEED_ADDRESS = "669U43LNHx7LsVj95uYksnhXUfWKDsdzVqev3V4Jpw3P";
  const CHAINLINK_PROGRAM_ID = new anchor.web3.PublicKey(
    "cjg3oHmg9uuPsP8D6g29NWvhySJkdYdAo9D25PRbKXJ"
  );
  const feedAddress = new anchor.web3.PublicKey(CHAINLINK_FEED_ADDRESS); //ETH-USD Devnet

  //load the data feed account
  let dataFeed = await OCR2Feed.load(CHAINLINK_PROGRAM_ID, provider);
  let listener = null;

  //listen for events agains the price feed, and grab the latest rounds price data
  listener = dataFeed.onRound(feedAddress, (event) => {
    console.log(event.answer.toNumber());
  });

  //block execution and keep waiting for events to be emitted with price data
  await new Promise(function () {});
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  }
);
