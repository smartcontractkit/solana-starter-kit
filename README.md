<br/>
<p align="center">
<a href="https://chain.link" target="_blank">
<img src="./solana_logo.png" width="225" alt="Chainlink Solana logo">
</a>
</p>
<br/>

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/smartcontractkit/solana-starter-kit)

# Chainlink Solana Starter Kit

The Chainlink Solana Starter Kit is an [Anchor](https://project-serum.github.io/anchor/getting-started/introduction.html) based program and client that shows developers how to use and interact with [Chainlink Price Feeds on Solana](https://docs.chain.link/solana/). The demo is configured to run on the [Devnet cluster](https://docs.solana.com/clusters#devnet), and is comprised of an on-chain program written in Rust, and an off-chain client written in JavaScript. The program takes parameters and account information from the off-chain client, retrieves the latest price data from the specified Chainlink Price Feed on Devnet, then writes the data out to the specified account, which can then be read by the off-chain client.

## Environment Variables

The following environment variables must be set before running the scripts:

| Variable          | Description                                                        | Required For                   |
| ----------------- | ------------------------------------------------------------------ | ------------------------------ |
| `EVM_PRIVATE_KEY` | The private key for the EVM account                                | All EVM chain operations       |
| `EVM_RPC_URL`     | RPC URL for Ethereum Sepolia                                       | Operations on Ethereum Sepolia |
| `AVAX_RPC_URL`    | RPC URL for Avalanche Fuji                                         | Operations on Avalanche Fuji   |
| `SOLANA_RPC_URL`  | RPC URL for Solana Devnet (defaults to public endpoint if not set) | Operations on Solana Devnet    |

### Setting up Environment Variables

Create a `.env` file in the root directory with the following format:

```
EVM_PRIVATE_KEY=your_private_key_here
EVM_RPC_URL=https://your-ethereum-sepolia-rpc-url
AVAX_RPC_URL=https://your-avalanche-fuji-rpc-url
SOLANA_RPC_URL=https://your-solana-devnet-rpc-url
```

**Important**: The RPC URLs must be valid and accessible for the scripts to work. If an RPC URL is not provided for a chain, an error will be thrown when attempting to use that chain.

## Running the example on Devnet

### Requirements

- [NodeJS 12](https://nodejs.org/en/download/) or higher
- [Rust](https://www.rust-lang.org/tools/install) - we recommend rustc version 1.87 and above
- [Solana CLI](https://docs.solanalabs.com/cli/install) - we recommend v0.31.1
- [Anchor](https://book.anchor-lang.com/getting_started/installation.html) - re recommend v2.1.21 and above.
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

**Note for [Apple M1](https://en.wikipedia.org/wiki/Apple_M1) chipsets**: You will need to perform an extra step to get the Anchor framework installed manually from source, as the NPM package only support x86_64 chipsets currently, please run the following command to install it manually:

```
cargo install --git https://github.com/coral-xyz/anchor --tag v0.31.1 anchor-cli --locked
```

Next, generate a new wallet:

```
solana-keygen new -o id.json
```

You should see the public key in the terminal output. Alternatively, you can find the public key with the following CLI command:

```
solana-keygen pubkey id.json
```

Next, airdrop 5 SOL tokens into your new account. Be sure to replace both instances of <RECIPIENT_ACCOUNT_ADDRESS> with your wallet's public key from the previous step:

```
solana airdrop $(solana address --keypair id.json) --url https://api.devnet.solana.com
```

Confirm that you have received the 5 SOL by running `solana balance --keypair id.json`.

Next, build the program:

```
anchor build
```

The build process generates a keypair for your CCIP Receiver Solana program (not to be confused with your wallet keypair we generated earlier). Before you deploy the `ccip_basic_receiver` Solana program, you must update it's public key in this line in the `./programs/ccip-basic-receiver/src/lib.rs` file:

```
declare_id!("####GEg__SOME__KEY__HERE__F2TsL#####");
```

This `declare_id!` macro is used to hardcode the program's public key directly into the 
program's bytecode. 

To update this public key, you need to run the command below:

```
anchor keys sync
```


After this command, check the file `./programs/ccip-basic-receiver/src/lib.rs` again. The line will be updated and show a new program account, for eg:

```
declare_id!("JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm");
```

To avoid having to add `--keypair id.json` to future commands now is a good time to add the following in your terminal:

` export ANCHOR_WALLET="./id.json" ` --> include the quotes

Finally, because you updated the source code with its generated public key, you need to rebuild the program to regenerate the associated files for deployment, and then it can be deployed to devnet


```
anchor build
anchor deploy --provider.cluster devnet
```

Once you have successfully deployed the program, the terminal output will specify the program ID of the program.   Make sure you're looking for the Program ID of the `ccip-basic-receiver` program (and not any other program that also got deployed). 

The Program ID for your `ccip-basic-receiver` program must match the value you inserted into the `./programs/ccip-basic-receiver/src/lib.rs` file. 


🚨 The `declare_id!` and your deployed program ID  should be the same. If they're different, it could indicate:

- You didn't run anchor keys sync after the initial build
- You didn't rebuild after syncing keys
- There was an issue during the deployment process



Once again, take note of this Program ID, as it will be required when executing the client:

```
Deploying workspace: https://api.devnet.solana.com
Upgrade authority: ./id.json
Deploying program "chainlink_solana_demo"...
Program path: ./target/deploy/chainlink_solana_demo.so...
Program Id: JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm
```

### Running the Client

Next we set up the JavaScript client that interacts with our deployed program on Devnet.

The first step is to set the Anchor [environment variables](https://www.twilio.com/blog/2017/01/how-to-set-environment-variables.html). These are required by the Anchor framework to determine which provider to use and which wallet to use for interacting with the deployed program:

```
export ANCHOR_PROVIDER_URL='https://api.devnet.solana.com'
export ANCHOR_WALLET='./id.json'
```

Now you are ready to run the JavaScript client. Be sure to pass Chainlink data feed address that you want to query. This can be taken from the [Chainlink Solana Data Feeds page](https://docs.chain.link/docs/solana/data-feeds-solana/), and the value will be defaulted to the Devnet SOL/USD feed address if you don't specify a value. In this example, we specified the ETH/USD feed:

```
node client.js --feed	669U43LNHx7LsVj95uYksnhXUfWKDsdzVqev3V4Jpw3P
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

### Running the Read Only Clients

To facilitate the scenario of purely requiring Chainlink Price Feed data off-chain, we have also included a second `read-data` client that queries a specified price feed and returns the latest price data. This version of the client does not generate a transaction, and therefore requires no accounts created or transaction fees. To run the read-data client, first you should ensure you have set the required Anchor environment variables. You can skip this step if you already did it earlier before running the normal client:

```
export ANCHOR_PROVIDER_URL='https://api.devnet.solana.com'
export ANCHOR_WALLET='./id.json'
```

Next, you can set the value of the `CHAINLINK_FEED_ADDRESS` static variable to the value of the [Price Feed account address](https://docs.chain.link/docs/solana/data-feeds-solana/) that you wish to query. This example queries the ETH/USD feed on Devnet:

```
const CHAINLINK_FEED_ADDRESS="669U43LNHx7LsVj95uYksnhXUfWKDsdzVqev3V4Jpw3P"
```

Once you save your file, you can then execute the client. There is a [Typescript](https://github.com/smartcontractkit/solana-starter-kit/blob/main/read-data.ts) and a [JavaScript](https://github.com/smartcontractkit/solana-starter-kit/blob/main/read-data.js) version:

Typescript:

```
yarn read-data
```

JavaScript:

```
node read-data.js
```

The client will query the specified price feed using the published [Chainlink Solana NPM package](https://www.npmjs.com/package/@chainlink/solana-sdk), and will then continuously just print the latest price to the console.

```
pappas99@Pappas solana-starter-kit % yarn read-data
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
