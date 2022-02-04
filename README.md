# Chainlink Solana Demo
The Chainlink Solana Demo is an [Anchor](https://project-serum.github.io/anchor/getting-started/introduction.html) based library that shows developers how to use and interact with [Chainlink Price Feeds on Solana](https://docs.chain.link/solana/). The demo is configured to run on the [Devnet cluster](https://docs.solana.com/clusters#devnet), and is comprised of an on-chain program written in Rust, and an off-chain client written in JavaScript. The program takes paramters and account information from the off-chain client, retrieves the latest price data from the specified Chainlink Price Feed on Devnet, then writes the data out to the specified account, which can then be read by the off-chain client.

## Running the example on Devnet

### Requirements
- [NodeJS 12](https://nodejs.org/en/download/) or higher
- [Rust](https://www.rust-lang.org/tools/install)
- [Solana CLI](https://github.com/solana-labs/solana/releases)

### Building and Deploying the Consumer Program

First, ensure that you're in the `solana-starter-kit` directory in this repository
```
cd ./solana-starter-kit
```

Next step is to install all of the required dependencies:
```
npm install
```


Next, generate a new wallet:
```
solana-keygen new -o id.json
```

You should see the public key in the terminal output. Alternatively, you can find the public key  with the following CLI command:

```
solana-keygen pubkey id.json
```

Next, airdrop some SOL tokens into your new account. We will need to call this twice, because the Devnet faucet is limited to 2 SOL, and we need approximately 4 SOL. Be sure to replace both instances of <RECIPIENT_ACCOUNT_ADDRESS> with your wallet's public key from the previous step:
```
solana airdrop 2 $(solana-keygen pubkey ./id.json) --url https://api.devnet.solana.com && solana airdrop 2 $(solana-keygen pubkey ./id.json) --url https://api.devnet.solana.com
```

Next, build the program:

```
anchor build
```

The build process generates the keypair for your program's account. Before you deploy your program, you must add this public key to the lib.rs file. To do this, you need to get the keypair from the ./target/deploy/chainlink_solana_demo-keypair.json file that Anchor generated:

```
solana address -k ./target/deploy/chainlink_solana_demo-keypair.json
```

The next step is to edit the [lib.rs](./programs/chainlink_solana_demo/src/lib.rs) file and replace the keypair in the declare_id!() definition with the value you obtained from the previous step:

```
declare_id!("JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm");
```

Next, you also need to insert the deployed Program ID value into the [Anchor.toml](./Anchor.toml) file in the `chainlink_solana_demo` devnet defintion

```
[programs.devnet]
chainlink_solana_demo = "JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm"
```

Finally, because you updated the source code with the generated program ID, you need to rebuild the program again, and then it can be deployed to devnet

```
anchor build
anchor deploy --provider.cluster devnet
```

Once you have successfully deployed the program, the terminal output will specify the program ID of the program, it should match the value you inserted into the lib.rs file and the Anchor.toml file. Once again, take note of this Program ID, as it will be required when executing the client:

```
Deploying workspace: https://api.devnet.solana.com
Upgrade authority: ./id.json
Deploying program "chainlink_solana_demo"...
Program path: ./target/deploy/chainlink_solana_demo.so...
Program Id: JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm
```

### Running the Client
First step is set the Anchor [environment variables](https://www.twilio.com/blog/2017/01/how-to-set-environment-variables.html). These are required by the Anchor framework to determine which Provider to use, as well as which Wallet to use for interacting with the deployed program:
```
export ANCHOR_PROVIDER_URL='https://api.devnet.solana.com'
export ANCHOR_WALLET='./id.json'
```

Now you are ready to run the JavaScript client. Be sure to pass the program ID obtained from the previous steps by using the --program flag. linking to the json file containing the account that owns the program, as well as the chainlink feed address that you wish to query. This can be taken from the [Chainlink Solana Feeds page](https://docs.chain.link/docs/solana/data-feeds-solana/), and the value will be defaulted to the Devnet SOL/USD feed address if you don’t specify a value. In this example, we’re specifying the ETH/USD feed:


```
node client.js --program $(solana address -k ./target/deploy/chainlink_solana_demo-keypair.json) --feed 5zxs8888az8dgB5KauGEFoPuMANtrKtkpFiFRmo3cSa9
```

The client will generate a new account and pass it to the deployed program, which will then populate the account with the current price from the specified price feed. The client will then read the price from the account, and output the value to the console.
```
Running client...
priceFeedAccount public key: DNQBqwGijKix2EmKhMMaftZgSywcbfnQZSzfDyEMEfLf
user public key: GWKzUMdSF8Y4xQ3JANTChkaJDFE4UdkvAkHCknmJtJUX
Fetching transaction logs...
[
  'Program FuwdLhVynFfsA3uLtYkixyFsabY3Qu31w3KhPcd1QJ8Z invoke [1]',
  'Program log: Instruction: Execute',
  'Program 11111111111111111111111111111111 invoke [2]',
  'Program 11111111111111111111111111111111 success',
  'Program CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT invoke [2]',
  'Program log: Instruction: Query',
  'Program CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT consumed 2916 of 186595 compute units',
  'Program return: CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT NX8BAFDJ/GEAAAAAQOCfIUEAAAAAAAAAAAAAAA==',
  'Program CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT success',
  'Program CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT invoke [2]',
  'Program log: Instruction: Query',
  'Program CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT consumed 2910 of 179949 compute units',
  'Program return: CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT CQAAAEVUSCAvIFVTRA==',
  'Program CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT success',
  'Program CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT invoke [2]',
  'Program log: Instruction: Query',
  'Program CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT consumed 2332 of 172986 compute units',
  'Program return: CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT CA==',
  'Program CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT success',
  'Program log: ETH / USD price is 2797.37000000',
  'Program FuwdLhVynFfsA3uLtYkixyFsabY3Qu31w3KhPcd1QJ8Z consumed 32795 of 200000 compute units',
  'Program return: CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT CA==',
  'Program FuwdLhVynFfsA3uLtYkixyFsabY3Qu31w3KhPcd1QJ8Z success'
]
Price Is: 2797.37
Success
```

### Running the Read Only Client
To facilitate the scenario of purely requiring Chainlink Price Feed data off-chain, we have also included a second `read-data` client that queries a specified price feed and returns the latest price data. This version of the client does not generate a transaction, and therefore requires no accounts created or transaction fees. To run the read-data client, first you should ensure you have set the required Anchor environment variables. You can skip this step if you already did it earlier before running the normal client:

```
export ANCHOR_PROVIDER_URL='https://api.devnet.solana.com'
export ANCHOR_WALLET='./id.json'
```

Next, you can run the read-data client, passing in the [Price Feed account address](https://docs.chain.link/docs/solana/data-feeds-solana/) that you wish to query. This example queries the ETH/USD feed:


```
node read-data.js --feed 5zxs8888az8dgB5KauGEFoPuMANtrKtkpFiFRmo3cSa9
```

The client will query the specified price feed using two methods. The first method returns price data by directly reading the account of the specified price feed, and is suited for scenarios of when a single price value is required. The second method obtains price data from the `NewTransmission` event emitted by the Price Feed on-chain program, and is more suited to front-ends and dApps that require constant price updates.

```
Running client...
trying with getAccountInfo
5zxs8888az8dgB5KauGEFoPuMANtrKtkpFiFRmo3cSa9
Feed: ETH / USD
timestamp  is: 1643957706
latest price is: 2,795.55
------------------------------------------------------
now getting price data with streams/events
{
  signature: '3415SKx9pdFRyYiMxEqRUvF6DuqobfUAWoQ4pTymRdYPXGDXHyuPuxcsiRf91bhcRBUe6DKNSNvLbEjwXC657bAe',
  err: null,
  logs: [
    'Program HW3ipKzeeduJq6f1NqRCw4doknMeWkfrM4WxobtG3o5v invoke [1]',
    'Program log: gjbLTR5rT6i6gAEAAAO0yW6pYD5plNHCZu1SwDAMsuXx2mG4ubp6E+F9DOAAuLAUQQAAAAAAAAAAAAAAA9/N/GEgAwABAgAAAAAAAAAAAAAAAAAAAOiqOQkAAAAAQANSLrQAAAA=',
    'Program CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT invoke [2]',
    'Program log: Instruction: Submit',
    'Program CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT consumed 5981 of 131061 compute units',
    'Program CaH12fwNTKJAG8PxEvo9R96Zc2j8qNHZaFj8ZW49yZNT success',
    'Program HW3ipKzeeduJq6f1NqRCw4doknMeWkfrM4WxobtG3o5v consumed 76000 of 200000 compute units',
    'Program HW3ipKzeeduJq6f1NqRCw4doknMeWkfrM4WxobtG3o5v success'
  ]
}
{
  data: {
    roundId: 98490,
    configDigest: [
        0,   3, 180, 201, 110, 169, 96,  62,
      105, 148, 209, 194, 102, 237, 82, 192,
       48,  12, 178, 229, 241, 218, 97, 184,
      185, 186, 122,  19, 225, 125, 12, 224
    ],
    answer: <BN: 4114b0b800>,
    transmitter: 3,
    observationsTimestamp: 1643957727,
    observers: [
      32, 3, 0, 1, 2, 0, 0,
       0, 0, 0, 0, 0, 0, 0,
       0, 0, 0, 0, 0
    ],
    juelsPerLamport: <BN: 939aae800>,
    reimbursement: <BN: b42e52034000>
  },
  name: 'NewTransmission'
}
timestamp  is: 1643957727
latest price is: 2,795.2
```


### Testing
You can execute the [integration test](./tests/chainlink-solana-demo-int-test.ts) with the following command

```bash
anchor test
```
The integration test will check that the value of the specieid price feed account (defaulted to SOL/USD) on Devnet is greater than 0

```bash
 solana-starter-kit

Price Is: 105.52
    ✔ Query SOL/USD Price Feed! (4521ms)


  1 passing (5s)

✨  Done in 10.49s.
```
