// Parse arguments
// --feed - The account address for the Chainlink data feed to retrieve
const args = require('minimist')(process.argv.slice(1));

const anchor = require("@project-serum/anchor");
const web3 = require("@solana/web3.js");
const borsh = require("borsh")
const provider = anchor.Provider.env();
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

async function main() {

  //First we create a connection to the store program for Chainlink feeds on devnet
  let storeIdl = JSON.parse(require("fs").readFileSync('./store.json'));
  const storeProgram = new anchor.Program(storeIdl, CHAINLINK_PROGRAM_ID, provider);


  //Call the query function on the store program, passing in the price feed account address we want to pull data from
  let tx = await storeProgram.rpc.query(
    Scope.LatestRoundData,
    {
      accounts: { feed: CHAINLINK_FEED },
      options: { commitment: "confirmed" },
    }
  );

  // Wait to get the data
  let t = await provider.connection.getConfirmedTransaction(tx, "confirmed");
  //console.log(t.meta.logMessages);

  const prefix = "Program return: ";
  let log = t.meta.logMessages.find((log) => log.startsWith(prefix));
  log = log.slice(prefix.length);
  let [_key, data] = log.split(" ", 2);
  let buf = Buffer.from(data, "base64");
  //console.log(JSON.stringify(buf));


  let result = borsh.deserialize(roundSchema, Round, buf)['answer']
  let resultFormatted = (byteArrayToLong(result) / DIVISOR)
  console.log(resultFormatted)



  console.log('---------------------')
  console.log('Now trying with getAccountInfo')
  const publicKey = new web3.PublicKey(
    CHAINLINK_FEED
  );
  let tmp = await provider.connection.getAccountInfo(publicKey,{"encoding": "jsonParsed"})
  console.log(tmp['data'])
  let result2 = borsh.deserializeUnchecked(roundSchema, Round, tmp['data'])
  console.log(result2)
  let resultFormatted2 = (byteArrayToLong(result2.answer) / DIVISOR)
    console.log('timestamp: ' + result2.timestamp)
  console.log(resultFormatted2)


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
