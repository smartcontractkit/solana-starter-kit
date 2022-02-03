// Parse arguments
// --feed - The account address for the Chainlink data feed to retrieve
const args = require('minimist')(process.argv.slice(1));

const anchor = require("@project-serum/anchor");
const web3 = require("@solana/web3.js");
const borsh = require("borsh")
const provider = anchor.Provider.env();
const EventParser = require("@project-serum/anchor");
const Coder = require("@project-serum/anchor");

anchor.setProvider(provider);

const CHAINLINK_PROGRAM_ID = "CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT";
const DIVISOR = 100000000;

// Data feed account address
// Default is SOL / USD
const default_feed = "EdWr4ww1Dq82vPe8GFjjcVPo2Qno3Nhn6baCgM3dCy28";
const CHAINLINK_FEED = args['feed'] || default_feed;


class Assignable {
  constructor(properties) {
    Object.keys(properties).map((key) => {
      this[key] = properties[key];
    });
  }
}

//Round class, used for serializing & deserializing round data
class Round extends Assignable {
}

// Transmission class, used for getting latest price data without making a tx
class Transmissions extends Assignable {
}

class Transmission extends Assignable {
}

const Scope = {
  Version: { version: {} },
  Decimals: { decimals: {} },
  Description: { description: {} },
  LatestRoundData: { latestRoundData: {} },
  Aggregator: { aggregator: {} },
};

const roundSchema = new Map([[Round, {
  kind: 'struct', fields: [
    ['roundId', 'u32'],
    ['timestamp', 'u64'],
    ['answer', [16]]
  ]
}]]);

const transmissionsSchema = new Map([[Transmissions, {
  kind: 'struct', fields: [
    ['versions', 'u8'],
    ['store', [32]],
    ['writer', [32]],
    ['description', [32]],
    ['decimals', 'u32'],
    ['flagging_threshold', 'u32'],
    ['latest_round_id', 'u32'],
    ['granularity', 'u8'],
    ['live_length', 'u32'],
    ['live_cursor', 'u32'],
    ['historical_cursor', 'u32']
  ]
}]]);

const transmissionSchema = new Map([[Transmission, {
  kind: 'struct', fields: [
    ['timestamp', 'u64'],
    ['answer', 'u128']
  ]
}]]);

async function main() {

  //First we create a connection to the store program for Chainlink feeds on devnet
  let storeIdl = JSON.parse(require("fs").readFileSync('./store.json'));
  const storeProgram = new anchor.Program(storeIdl, CHAINLINK_PROGRAM_ID, provider);
/*
  console.log('trying with getAccountInfo')
  const publicKey = new web3.PublicKey(
    CHAINLINK_FEED
  );

  // The feed account is essentially a 128 byte header we can automatically parse with Anchor,
  // then we need to calculate the transmission offset and read the round there via borsh.

  // get the transmission header
  const headerStart = 8

  const accountData = await provider.connection._rpcRequest('getAccountInfo',
    [
      CHAINLINK_FEED,
      {
        encoding: 'base64',
        commitment: 'finalized',
        dataSlice: { "offset": headerStart, "length": 128 }
      }
    ]
  );
  //note, no error handling for acct not found - blindly going after data
  //console.log(accountData)

  const buf = Buffer.from(accountData.result.value.data[0], 'base64');
  //console.log(buf)

  // deserialize the buffer into a header
  let resultHeader = borsh.deserializeUnchecked(transmissionsSchema, Transmissions, buf)
  //console.log(resultHeader)

  console.log('Feed Desc: ' + String.fromCharCode.apply(String, resultHeader.description))


  // set transmission
  let cursor = resultHeader.live_cursor
  let liveLength = resultHeader.live_length
  //console.log('live cursor: ' + cursor)
  //console.log('live liveLength: ' + liveLength)
  if (cursor == 0) {
    cursor = liveLength
  }
  cursor = cursor - 1

  const transmissionLength = 24
  //let transmissionOffset = 8 + 128 + (cursor * transmissionLength) //13215856 // THIS PART ISN'T WORKING
  let transmissionOffset = 136 + (24 * 1023)
  console.log('transmission offset: ' + transmissionOffset)

  console.log('getting transmission data')

  // do account info again with new paramrs to get the transmission
  const transmissionData = await provider.connection._rpcRequest('getAccountInfo',
    [
      CHAINLINK_FEED,
      {
        encoding: 'base64',
        commitment: 'confirmed',
        dataSlice: { "offset": transmissionOffset, "length": transmissionLength }
      }
    ]
  );

  //console.log(transmissionData)
  //console.log('buffer length: ' + Buffer.byteLength(transmissionData.result.value.data[0], 'base64'))
  //  console.log(JSON.stringify(transmissionData))


  const transmissionDataBuf = Buffer.from(transmissionData.result.value.data[0], 'base64');
  //console.log(transmissionDataBuf)

  //parse v1 transmission and return answer
  //deserialize tranmission into object
  let resultTransmission = borsh.deserializeUnchecked(transmissionSchema, Transmission, transmissionDataBuf)
  console.log(JSON.stringify(resultTransmission))

  // parse transmission
  //unix time 1643763291

  console.log('timestamp  is: ' + resultTransmission.timestamp)
  console.log('latest price is: ' + resultTransmission.answer)

*/
  console.log('------------------------------------------------------')
  console.log('now trying with streams/events')




//  const idl = {...}; // your idl here
  const coder = new anchor.Coder(storeIdl);
  const parser = new anchor.EventParser('EdWr4ww1Dq82vPe8GFjjcVPo2Qno3Nhn6baCgM3dCy28', coder);

  // Parse a string[] of logs from a transaction.
  parser.parseLogs('logs', (event) => console.log(event));

  // Parse a single log.
  coder.events.decode(log);

}

byteArrayToLong = function (/*byte[]*/byteArray) {
  var value = 0;
  for (var i = byteArray.length - 1; i >= 0; i--) {
    value = (value * 256) + byteArray[i];
  }

  return value;
};

console.log("Running client...");
main().then(() => console.log("Success"));
