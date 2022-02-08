const args = require('minimist')(process.argv.slice(1));
const anchor = require("@project-serum/anchor");
const web3 = require("@solana/web3.js");
const borsh = require("borsh")
const fs = require('fs')
const provider = anchor.Provider.env();

let BN = anchor.BN;

anchor.setProvider(provider);

// Static values of Chainlink implementation on Devnet
const CHAINLINK_STORE_PROGRAM_ID = "CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT";
const CHAINLINK_OCR2_PROGRAM_ID = "HW3ipKzeeduJq6f1NqRCw4doknMeWkfrM4WxobtG3o5v";

const DECIMALS = 8;

// Data feed account address
// Default is SOL / USD
const default_feed = "EdWr4ww1Dq82vPe8GFjjcVPo2Qno3Nhn6baCgM3dCy28";
const CHAINLINK_FEED = new web3.PublicKey(args['feed'] || default_feed);

class Assignable {
  constructor(properties) {
    Object.keys(properties).map((key) => {
      this[key] = properties[key];
    });
  }
}

class Transmission extends Assignable {
}

const transmissionSchema = new Map([[Transmission, {
  kind: 'struct', fields: [
    ['timestamp', 'u64'],
    ['answer', [16]] // i128
  ]
}]]);

async function main() {

  // First we create a connection to the store program for Chainlink feeds on devnet
  const storeProgram = await anchor.Program.at(CHAINLINK_STORE_PROGRAM_ID, provider);
  const ocr2Program = await anchor.Program.at(CHAINLINK_OCR2_PROGRAM_ID, provider);

  console.log('trying with getAccountInfo')

  // The feed account is essentially a 128 byte header we can automatically parse with Anchor,
  // then we need to calculate the transmission offset and read the round information.

  console.log(CHAINLINK_FEED.toString());

  // get the transmission header
  const accountData = await provider.connection._rpcRequest('getAccountInfo',
    [
      CHAINLINK_FEED.toString(),
      {
        encoding: 'base64',
        commitment: 'finalized',
        dataSlice: { "offset": 0, "length": 128 + 8 }
      }
    ]
  );
  // note, no error handling for acct not found - blindly going after data

  const buf = Buffer.from(accountData.result.value.data[0], 'base64');

  // deserialize the buffer into a header
  const header = storeProgram.coder.accounts.decode('Transmissions', buf);

  console.log('Feed: ' + String.fromCharCode.apply(String, header.description))

  // set transmission
  let cursor = header.liveCursor
  const liveLength = header.liveLength
  if (cursor == 0) {
    cursor = liveLength
  }
  cursor = cursor - 1

  const transmissionLength = 24
  let transmissionOffset = 8 + 128 + (cursor * 24);

  // do account info again with new paramrs to get the transmission
  const transmissionData = await provider.connection._rpcRequest('getAccountInfo',
    [
      CHAINLINK_FEED.toString(),
      {
        encoding: 'base64',
        commitment: 'confirmed',
        dataSlice: { "offset": transmissionOffset, "length": transmissionLength }
      }
    ]
  );

  const transmissionDataBuf = Buffer.from(transmissionData.result.value.data[0], 'base64');

  // parse v1 transmission and return answer
  // deserialize tranmission into object
  let resultTransmission = borsh.deserializeUnchecked(transmissionSchema, Transmission, transmissionDataBuf)
  //console.log(JSON.stringify(resultTransmission))

  // parse answer
  let answer = new BN(resultTransmission.answer, 10, 'le');

  console.log('timestamp  is: ' + resultTransmission.timestamp)
  console.log('latest price is: ' + format(answer))


  console.log('------------------------------------------------------')
  console.log('now getting price data with streams/events')


  const parser = new anchor.EventParser(CHAINLINK_OCR2_PROGRAM_ID, ocr2Program.coder);

  provider.connection.onLogs(CHAINLINK_FEED, (event) => {
    console.log(event);
      parser.parseLogs(event.logs, (log) => {
        // TODO: filter by log.name == 'NewTransmission'
        console.log(log)
        let event = log.data;
        let answer = new BN(event.answer, 10, 'le');
        console.log('timestamp  is: ' + event.observationsTimestamp)
        console.log('latest price is: ' + format(answer, DECIMALS))
      })
  })

  // Sleep forever until Ctrl-c
  await new Promise(function () {});
}

// function scale(value: number | BN, decimals): number {
function scale(value, decimals) {
  const absValue = value.abs();
  const valueString = absValue.toString(10, 18);
  let splitIndex = valueString.length - decimals;
  const scaledString =
    valueString.slice(0, splitIndex) +
    "." +
    valueString.slice(splitIndex);
  return scaledString
}

function format(value, maximumFractionDigits = 8) {
  const total = scale(value, maximumFractionDigits);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(total);
}
console.log("Running client...");
main().then(() => console.log("Success"));