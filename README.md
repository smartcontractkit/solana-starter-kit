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
solana airdrop 2 <RECIPIENT_ACCOUNT_ADDRESS> --url https://api.devnet.solana.com && solana airdrop 2 <RECIPIENT_ACCOUNT_ADDRESS> --url https://api.devnet.solana.com
```

Next, build and deploy the program:

```
anchor build
anchor deploy --provider.cluster devnet
```

Once you have successfully deployed the program, the terminal output will specify the program ID of the program. Take note of this, as it will be required in the client:

```
Deploying workspace: https://api.devnet.solana.com
Upgrade authority: ./id.json
Deploying program "chainlink_solana_demo"...
Program path: ./target/deploy/chainlink_solana_demo.so...
Program Id: 39zEiws4s9ffMkr4hK84nqF2nLQFGP8aQpPPgN6H2hWu
```

### Running the Client
Copy the `program_id` from the previous step, or alternatively you can get the deployed program ID with the following command:
```
solana-keygen pubkey target/deploy/chainlink_solana_demo-keypair.json
```

Once you have the deployed program ID, insert it into `client.js`, replacing the <DEPLOYED_PROGRAM_ID_GOES_HERE> string with the program ID.

```
const programId = new anchor.web3.PublicKey("<DEPLOYED_PROGRAM_ID_GOES_HERE>");
```

Next, ensure the `CHAINLINK_FEED` variable in `client.js` contains the [account of the price feed you want to query](https://docs.chain.link/docs/solana/data-feeds-solana/). In the demo it's defaulted to the Devnet [SOL/USD feed](https://solscan.io/account/7ndYj66ec3yPS58kRpodch3n8TEkCiaiy8tZ8Szb3BjP?cluster=devnet).

```
const CHAINLINK_FEED = "7ndYj66ec3yPS58kRpodch3n8TEkCiaiy8tZ8Szb3BjP";
```

The next step is to set the Anchor [environment variables](https://www.twilio.com/blog/2017/01/how-to-set-environment-variables.html). These are required by the Anchor framework to determine which Provider to use, as well as which Wallet to use for interacting with the deployed program:
```
export ANCHOR_PROVIDER_URL='https://api.devnet.solana.com'
export ANCHOR_WALLET='./id.json'
```

Now you are ready to run the Node.JS client:

```
node client.js
```

The client will generate a new account and pass it to the deployed program, which will then populate the account with the current price from the specified price feed. The client will then read the price from the account, and output the value to the console.
```
Running client...
Fetching transaction logs...
[
  'Program EsYPTcY4Be6GvxojV5kwZ7W2tK2hoVkm9XSN7Lk8HAs8 invoke [1]',
  'Program log: Instruction: Execute',
  'Program 11111111111111111111111111111111 invoke [2]',
  'Program 11111111111111111111111111111111 success',
  'Program DWqYEinRbZWtuq1DiDYvmexAKFoyjSyazZZUvdgPHT5g invoke [2]',
  'Program log: Instruction: Query',
  'Program DWqYEinRbZWtuq1DiDYvmexAKFoyjSyazZZUvdgPHT5g consumed 2916 of 186595 compute units',
  'Program return: DWqYEinRbZWtuq1DiDYvmexAKFoyjSyazZZUvdgPHT5g qpoFAMBI82EAAAAAAMAOFgIAAAAAAAAAAAAAAA==',
  'Program DWqYEinRbZWtuq1DiDYvmexAKFoyjSyazZZUvdgPHT5g success',
  'Program DWqYEinRbZWtuq1DiDYvmexAKFoyjSyazZZUvdgPHT5g invoke [2]',
  'Program log: Instruction: Query',
  'Program DWqYEinRbZWtuq1DiDYvmexAKFoyjSyazZZUvdgPHT5g consumed 2910 of 179949 compute units',
  'Program return: DWqYEinRbZWtuq1DiDYvmexAKFoyjSyazZZUvdgPHT5g CQAAAFNPTCAvIFVTRA==',
  'Program DWqYEinRbZWtuq1DiDYvmexAKFoyjSyazZZUvdgPHT5g success',
  'Program DWqYEinRbZWtuq1DiDYvmexAKFoyjSyazZZUvdgPHT5g invoke [2]',
  'Program log: Instruction: Query',
  'Program DWqYEinRbZWtuq1DiDYvmexAKFoyjSyazZZUvdgPHT5g consumed 2332 of 172986 compute units',
  'Program return: DWqYEinRbZWtuq1DiDYvmexAKFoyjSyazZZUvdgPHT5g CA==',
  'Program DWqYEinRbZWtuq1DiDYvmexAKFoyjSyazZZUvdgPHT5g success',
  'Program log: SOL / USD price is 89.60000000',
  'Program EsYPTcY4Be6GvxojV5kwZ7W2tK2hoVkm9XSN7Lk8HAs8 consumed 32730 of 200000 compute units',
  'Program return: DWqYEinRbZWtuq1DiDYvmexAKFoyjSyazZZUvdgPHT5g CA==',
  'Program EsYPTcY4Be6GvxojV5kwZ7W2tK2hoVkm9XSN7Lk8HAs8 success'
]
Price Is: 8960000000
Success
```

### Testing
Before executing the integration test, first you need to extract the `program ID` from the deploying the program step, and insert it into the test script `chainlink-solana-demo-int-test.js`, replacing the <DEPLOYED_PROGRAM_ID_GOES_HERE> string with the program ID:

```
const programId = new anchor.web3.PublicKey("<DEPLOYED_PROGRAM_ID_GOES_HERE>");
```

Now you can execute the [integration test](./tests/chainlink-solana-demo-int-test.ts) with the following command

```bash
anchor test
```
The integration test will check that the value of the SOL/USD price feed on Devnet is greater than 0

```bash
 solana-starter-kit

Price Is: 8948181871
    ✔ Query SOL/USD Price Feed! (4521ms)


  1 passing (5s)

✨  Done in 10.49s.
```
