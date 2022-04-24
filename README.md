<br/>
<p align="center">
<a href="https://chain.link" target="_blank">
<img src="./solana_logo.png" width="225" alt="Chainlink Solana logo">
</a>
</p>
<br/>

# Chainlink Solana Starter Kit
The Chainlink Solana Starter Kit is an [Anchor](https://project-serum.github.io/anchor/getting-started/introduction.html) based program and client that shows developers how to use and interact with [Chainlink Price Feeds on Solana](https://docs.chain.link/solana/). The demo is configured to run on the [Devnet cluster](https://docs.solana.com/clusters#devnet), and is comprised of an on-chain program written in Rust, and an off-chain client written in JavaScript. The program takes paramters and account information from the off-chain client, retrieves the latest price data from the specified Chainlink Price Feed on Devnet, then writes the data out to the specified account, which can then be read by the off-chain client.

## Running the example on Devnet

### Requirements
- [NodeJS 12](https://nodejs.org/en/download/) or higher
- [Rust](https://www.rust-lang.org/tools/install)
- [Solana CLI](https://github.com/solana-labs/solana/releases)
- A C compiler such as the one included in [GCC](https://gcc.gnu.org/install/).

### Building and Deploying the Consumer Program

First, ensure that you're in the `solana-starter-kit` directory in this repository

```
cd ./solana-starter-kit
```

Next step is to install all of the required dependencies:

```
npm install
```

**Note for [Apple M1](https://en.wikipedia.org/wiki/Apple_M1) chipsets**: You will need to perform an extra step to get the Anchor framework installed manully from source, as the NPM package only support x86_64 chipsets currently, please run the following command to install it manually:

```
cargo install --git https://github.com/project-serum/anchor --tag v0.20.1 anchor-cli --locked
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

The first step is to set the Anchor [environment variables](https://www.twilio.com/blog/2017/01/how-to-set-environment-variables.html). These are required by the Anchor framework to determine which provider to use and which wallet to use for interacting with the deployed program:

```
export ANCHOR_PROVIDER_URL='https://api.devnet.solana.com'
export ANCHOR_WALLET='./id.json'
```

Now you are ready to run the JavaScript client. Be sure to pass the program ID obtained from the previous steps by using the `--program` flag pointing to the JSON file containing the account that owns the program, as well as the Chainlink data feed address that you want to query. This can be taken from the [Chainlink Solana Data Feeds page](https://docs.chain.link/docs/solana/data-feeds-solana/), and the value will be defaulted to the Devnet SOL/USD feed address if you don’t specify a value. In this example, we specified the ETH/USD feed:

```
node client.js --program $(solana address -k ./target/deploy/chainlink_solana_demo-keypair.json) --feed 	2ypeVyYnZaW2TNYXXTaZq9YhYvnqcjCiifW1C6n8b7Go
```

The client will generate a new account and pass it to the deployed program, which will then populate the account with the current price from the specified price feed. The client will then read the price from the account, and output the value to the console.

```
Running client...
priceFeedAccount public key: DNQBqwGijKix2EmKhMMaftZgSywcbfnQZSzfDyEMEfLf
user public key: GWKzUMdSF8Y4xQ3JANTChkaJDFE4UdkvAkHCknmJtJUX
Fetching transaction logs...
[
  'Program BrEqc6zHVR77jrP6U6WZLUV24AZ9UnHrWfDQTDV7VoDY invoke [1]',
  'Program log: Instruction: Execute',
  'Program 11111111111111111111111111111111 invoke [2]',
  'Program 11111111111111111111111111111111 success',
  'Program HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny invoke [2]',
  'Program log: Instruction: Query',
  'Program HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny consumed 2551 of 1360424 compute units',
  'Program return: HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny RZ0GABn5swcAAAAA3ltiYgAVg8dFAAAAAAAAAAAAAAA=',
  'Program HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny success',
  'Program HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny invoke [2]',
  'Program log: Instruction: Query',
  'Program HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny consumed 2245 of 1328033 compute units',
  'Program return: HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny CQAAAEVUSCAvIFVTRA==',
  'Program HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny success',
  'Program HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny invoke [2]',
  'Program log: Instruction: Query',
  'Program HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny consumed 1826 of 1295650 compute units',
  'Program return: HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny CA==',
  'Program HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny success',
  'Program log: ETH / USD price is 2997.00000000',
  'Program BrEqc6zHVR77jrP6U6WZLUV24AZ9UnHrWfDQTDV7VoDY consumed 109699 of 1400000 compute units',
  'Program return: BrEqc6zHVR77jrP6U6WZLUV24AZ9UnHrWfDQTDV7VoDY CA==',
  'Program BrEqc6zHVR77jrP6U6WZLUV24AZ9UnHrWfDQTDV7VoDY success'
]
Price Is: 2997
Success
```

### Running the Read Only Client

To facilitate the scenario of purely requiring Chainlink Price Feed data off-chain, we have also included a second `read-data` client that queries a specified price feed and returns the latest price data. This version of the client does not generate a transaction, and therefore requires no accounts created or transaction fees. To run the read-data client, first you should ensure you have set the required Anchor environment variables. You can skip this step if you already did it earlier before running the normal client:

```
export ANCHOR_PROVIDER_URL='https://api.devnet.solana.com'
export ANCHOR_WALLET='./id.json'
```

Next, you can set the value of the `CHAINLINK_FEED_ADDRESS` static variable to the value of the [Price Feed account address](https://docs.chain.link/docs/solana/data-feeds-solana/) that you wish to query. This example queries the ETH/USD feed:


```
const CHAINLINK_FEED_ADDRESS="2ypeVyYnZaW2TNYXXTaZq9YhYvnqcjCiifW1C6n8b7Go"
```

Once you save your file, you can then execute the client:

```
npm run read-data
```

The client will query the specified price feed using the published [Chainlink Solana NPM package](https://www.npmjs.com/package/@chainlink/solana-sdk), and will then continously just print the latest price to the console.

```
pappas99@Pappas solana-starter-kit % npm run read-data
> @ read-data /Users/pappas99/GitHub/22-hackathon/solana-starter-kit
> ts-node ./read-data.ts

301296000000
301250000000
301215000000
301205000000
301331000000
```


### Testing

You can execute the [integration test](./tests/chainlink-solana-demo-int-test.ts) with the following command

```bash
anchor test
```

The integration test checks that the value of the specified price feed account (defaulted to SOL/USD) on Devnet is greater than 0.

```bash
 solana-starter-kit

Price Is: 105.52
    ✔ Query SOL/USD Price Feed! (4521ms)


  1 passing (5s)

✨  Done in 10.49s.
```
