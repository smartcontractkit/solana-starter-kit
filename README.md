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
First step is to ensure the `CHAINLINK_FEED` variable in `client.js` contains the [account of the price feed you want to query](https://docs.chain.link/docs/solana/data-feeds-solana/). In the demo it's defaulted to the Devnet [SOL/USD feed](https://solscan.io/account/EdWr4ww1Dq82vPe8GFjjcVPo2Qno3Nhn6baCgM3dCy28?cluster=devnet).

```
const CHAINLINK_FEED = "EdWr4ww1Dq82vPe8GFjjcVPo2Qno3Nhn6baCgM3dCy28";
```

The next step is to set the Anchor [environment variables](https://www.twilio.com/blog/2017/01/how-to-set-environment-variables.html). These are required by the Anchor framework to determine which Provider to use, as well as which Wallet to use for interacting with the deployed program:
```
export ANCHOR_PROVIDER_URL='https://api.devnet.solana.com'
export ANCHOR_WALLET='./id.json'
```

Now you are ready to run the Node.JS client. Be sure to pass the program ID obtained from the previous steps by using the --program flag. linking to the json file containing the account that owns the program:

```
node client.js --program $(solana address -k ./target/deploy/chainlink_solana_demo-keypair.json)
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
  'Program JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm invoke [2]',
  'Program log: Instruction: Query',
  'Program JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm consumed 2916 of 186595 compute units',
  'Program return: JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm qpoFAMBI82EAAAAAAMAOFgIAAAAAAAAAAAAAAA==',
  'Program JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm success',
  'Program JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm invoke [2]',
  'Program log: Instruction: Query',
  'Program JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm consumed 2910 of 179949 compute units',
  'Program return: JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm CQAAAFNPTCAvIFVTRA==',
  'Program JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm success',
  'Program JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm invoke [2]',
  'Program log: Instruction: Query',
  'Program JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm consumed 2332 of 172986 compute units',
  'Program return: JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm CA==',
  'Program JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm success',
  'Program log: SOL / USD price is 105.520000000',
  'Program EsYPTcY4Be6GvxojV5kwZ7W2tK2hoVkm9XSN7Lk8HAs8 consumed 32730 of 200000 compute units',
  'Program return: JC16qi56dgcLoaTVe4BvnCoDL6FhH5NtahA7jmWZFdqm CA==',
  'Program EsYPTcY4Be6GvxojV5kwZ7W2tK2hoVkm9XSN7Lk8HAs8 success'
]
Price Is: 105.52
Success
```

### Testing
You can execute the [integration test](./tests/chainlink-solana-demo-int-test.ts) with the following command

```bash
anchor test
```
The integration test will check that the value of the SOL/USD price feed on Devnet is greater than 0

```bash
 solana-starter-kit

Price Is: 105.52
    ✔ Query SOL/USD Price Feed! (4521ms)


  1 passing (5s)

✨  Done in 10.49s.
```
