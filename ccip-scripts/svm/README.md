# Solana CCIP Scripts - Technical Documentation

This is the comprehensive technical guide for all Solana Virtual Machine (SVM) CCIP scripts. Each script includes detailed usage instructions, options, examples, and troubleshooting guidance.

> 📖 **This is the detailed technical reference for SVM operations**  
> For overview and quick start: [Main README](../README.md)

## Prerequisites

- Node.js v20+ (v23.11.0 recommended)
- Yarn
- Solana CLI tools
- A wallet with SOL on Devnet for testing
- `.config/solana/id.json` keypair used by default
- Optional: `.config/solana/keytest.json` for test operations

## Getting Started

Before running any scripts, ensure you have installed all dependencies:

```bash
yarn install
```

## Available Scripts

### 1. Token Management Scripts

**⚠️ IMPORTANT:** Running the token delegation script is a prerequisite for CCIP cross-chain transfers. You must delegate authority to the CCIP router before you can send tokens or pay fees with tokens other than native SOL.

#### 1.1. Create SPL Token (Legacy)

The `create-token-metaplex.ts` script creates a new SPL Token (legacy token program) with Metaplex metadata support. This creates tokens using the original token program for compatibility with older applications.

```bash
# Create SPL Token with default settings
yarn svm:token:create

# Create SPL Token with custom name and symbol
yarn svm:token:create -- --name "My Token" --symbol "MTK"

# Create SPL Token with custom metadata and supply
yarn svm:token:create -- --name "My Token" --symbol "MTK" --uri "https://example.com/metadata.json" --decimals 6 --initial-supply 5000000

# With debug logging
yarn svm:token:create -- --log-level DEBUG
```

**Key Features:**

- Uses the legacy SPL Token Program (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`)
- Compatible with all existing SPL token infrastructure
- Metaplex metadata support for rich token information
- Configurable decimals, supply, and metadata URI
- CLI argument parsing with sensible defaults

#### 1.2. Create Token-2022

The `create-token-2022.ts` script creates a new Token-2022 token with Metaplex metadata support. Token-2022 is the newer token standard that provides enhanced functionality including native metadata support.

```bash
# Create Token-2022 with default settings
yarn svm:token:create-2022

# Create Token-2022 with custom name and symbol
yarn svm:token:create-2022 -- --name "My Token" --symbol "MTK"

# Create Token-2022 with custom metadata and supply
yarn svm:token:create-2022 -- --name "My Token" --symbol "MTK" --uri "https://example.com/metadata.json" --decimals 6 --initial-supply 5000000

# With debug logging
yarn svm:token:create-2022 -- --log-level DEBUG
```

**Key Features:**

- Uses the Token-2022 Program (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`)
- Enhanced functionality with extensions support
- Native metadata support through Token Extensions
- Advanced features like transfer fees, interest-bearing tokens, etc.
- Forward-compatible with future token standard improvements

**Common Options for Both Scripts:**

- `--name <string>`: Token name (max 32 characters, default: "AEM")
- `--symbol <string>`: Token symbol (max 10 characters, default: "CCIP-AEM")
- `--uri <string>`: Metadata URI (default: sample URI - override recommended)
- `--decimals <number>`: Number of decimal places (0-9, default: 9)
- `--initial-supply <number>`: Initial token supply to mint (default: 1,000,000,000,000)
- `--fee-basis-points <number>`: Seller fee basis points (0-10000, default: 0)
- `--keypair <path>`: Path to wallet keypair file
- `--log-level <level>`: Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip transaction preflight checks
- `--help, -h`: Show usage information

**Which Token Standard Should You Choose?**

- **SPL Token (Legacy)** (`yarn svm:token:create`):

  - ✅ Maximum compatibility with existing applications
  - ✅ Smaller transaction sizes
  - ✅ Lower computational requirements
  - ❌ Limited extension capabilities

- **Token-2022** (`yarn svm:token:create-2022`):
  - ✅ Advanced features and extensions
  - ✅ Native metadata support
  - ✅ Future-proof for new functionality
  - ❌ Requires Token-2022 program support in applications

#### 1.3. Wrap SOL to wSOL

The `wrap-sol.ts` script allows you to wrap native SOL into wrapped SOL (wSOL) tokens.

```bash
# Use default keypair
yarn svm:token:wrap

# Specify amount of SOL to wrap
yarn svm:token:wrap -- --amount 2

# Use test keypair (if configured)
yarn svm:token:wrap -- --use-test-keypair
```

The script:

- Checks your SOL balance
- Wraps the specified amount (1 SOL by default) into wSOL
- Displays before and after balances

#### 1.4. Delegate Token Authority

The `delegate-token-authority.ts` script delegates token spending authority to the CCIP router's Program Derived Addresses (PDAs).

```bash
# Use default keypair
yarn svm:token:delegate

# Use test keypair (if configured)
yarn svm:token:delegate -- --use-test-keypair
```

This script:

- Delegates wSOL to the Fee Billing Signer PDA
- Delegates BnM tokens to the BnM Token Pool Signer PDA
- Delegates LINK tokens to the Fee Billing Signer PDA

**These delegations are necessary for:**

1. Transferring tokens cross-chain via CCIP
2. Using non-native tokens (like wSOL or LINK) to pay for CCIP fees

If you skip this step, your transfers will fail with permission errors.

#### 1.5. Check Token Approvals

The `check-token-approvals.ts` script checks the current delegation status of your token accounts.

```bash
# Use default keypair
yarn svm:token:check

# Use test keypair (if configured)
yarn svm:token:check -- --use-test-keypair
```

This script:

- Displays token balances
- Shows which addresses have delegation authority
- Shows how many tokens are delegated

Example output:

```
==== Summary ====
Mint | Token Account | Balance | Delegate | Delegated Amount
-----|--------------|---------|----------|-----------------
So111111... | aVmjJoty... | 2000009520 | 2bsR7jPW... | 18446744073709551615
7AC59PVv... | HWFMEkEa... | 10710000000 | BKy8ADoK... | 18446744073709551615
D3HCrigx... | 8U9xkMZU... | 0 | 2bsR7jPW... | 18446744073709551615
```

### 2. Token Pool Management

**⚠️ IMPORTANT:** Token pool operations must follow a specific order:

1. **Initialize Global Config** (once per program deployment) - Only by program upgrade authority
2. **Initialize Token Pool** (once per token) - By upgrade authority or mint authority
3. **Pool Management** (as needed) - Owner operations like setting router, transferring ownership

#### 2.1. Initialize Global Config

The `initialize-global-config.ts` script initializes the global configuration for a burn-mint token pool program. This **MUST** be run once per program deployment before any individual pools can be created.

```bash
# Initialize global config (must be run by program upgrade authority)
yarn svm:pool:init-global-config \
  --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh

# With debug logging
yarn svm:pool:init-global-config \
  --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \
  --log-level DEBUG
```

##### Required Options

- `--burn-mint-pool-program <id>`: Burn-mint token pool program ID

##### Optional Options

- `--keypair <path>`: Path to wallet keypair file (must be program upgrade authority)
- `--log-level <level>`: Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip transaction preflight checks

##### Important Notes

- **Authority Required**: Only the program upgrade authority can run this script
- **One-Time Operation**: This only needs to be run ONCE per program deployment
- **Prerequisite**: This must succeed before any token pools can be initialized
- **Scope**: Creates program-wide configuration, not token-specific settings

#### 2.2. Initialize Token Pool

The `initialize-pool.ts` script initializes a burn-mint token pool for CCIP cross-chain token transfers.

```bash
# Initialize a token pool
yarn svm:pool:initialize \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh

# With debug logging
yarn svm:pool:initialize \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \
  --log-level DEBUG
```

#### Required Options

- `--token-mint <address>`: Token mint address to create pool for
- `--burn-mint-pool-program <id>`: Burn-mint token pool program ID

#### Optional Options

- `--keypair <path>`: Path to wallet keypair file
- `--log-level <level>`: Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip transaction preflight checks

This script:

- Checks if a pool already exists for the token mint
- Initializes the burn-mint token pool with the CCIP router and RMN remote
- Sets the wallet as the pool administrator
- Verifies the pool was created successfully

**Prerequisites:**

1. **Global config must be initialized first** (use `yarn svm:pool:init-global-config`)
2. Token mint must already exist (use `yarn svm:token:create` to create one)
3. Wallet must have sufficient SOL balance for transaction fees (minimum 0.01 SOL)
4. Burn-mint pool program must be deployed and accessible

#### 2.3. Create Pool Token Account

The `create-pool-token-account.ts` script creates the Associated Token Account (ATA) for the pool signer PDA. This account is **required** for the pool to hold tokens during cross-chain operations and must be created after pool initialization.

**⚠️ CRITICAL:** This script resolves the common "AccountNotInitialized" error that occurs during cross-chain token transfers. The pool token account must exist before attempting any CCIP transfers.

```bash
# Create pool token account (ATA)
yarn svm:pool:create-token-account \
  --token-mint 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY \
  --burn-mint-pool-program 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz

# With debug logging
yarn svm:pool:create-token-account \
  --token-mint 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY \
  --burn-mint-pool-program 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz \
  --log-level DEBUG
```

##### Required Options

- `--token-mint <address>`: Token mint address for the pool
- `--burn-mint-pool-program <id>`: Burn-mint token pool program ID

##### Optional Options

- `--keypair <path>`: Path to wallet keypair file
- `--log-level <level>`: Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip transaction preflight checks

##### What This Script Does

The script performs the following operations:

1. **Pool Verification**: Confirms the token pool exists and retrieves configuration
2. **PDA Calculation**: Uses library function `findPoolSignerPDA` to derive the pool signer address
3. **ATA Derivation**: Calculates the Associated Token Account address for the pool signer
4. **Existence Check**: Verifies if the ATA already exists to avoid duplicate creation
5. **Account Creation**: Creates the ATA with correct ownership (pool signer PDA)
6. **Verification**: Confirms the account was created successfully

##### Example Output

```
CCIP Pool Token Account Creation

Loading keypair from /Users/user/.config/solana/id.json...
Wallet public key: EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB
Wallet balance: 11.372 SOL
Token Mint: 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY
Burn-Mint Pool Program: 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz

Verifying pool exists...
Getting pool information...
Current pool token account: DC4nBwHb6z5gAFJmi4Hkhn1TqaVDmhunqktSro16dAod
Pool signer PDA: 5aWw5TTbPDZvcwyy1fR6JLXS9RbG2hDPpzDtrbiEsaN8
Expected pool token account (ATA): DC4nBwHb6z5gAFJmi4Hkhn1TqaVDmhunqktSro16dAod

Creating pool token account (ATA)...
✅ Pool token account created successfully!
Transaction signature: iMHGzhF9JSnSdBK1mcurSUi1m38pyiitmGNMgzqfBMhPifgj4S72Tke8j3AsKWtVeNFariU1RpaM1NLo7JB8NUc
Solana Explorer: https://explorer.solana.com/tx/iMHGzhF9...?cluster=devnet

🎉 Pool Token Account Setup Complete!
   ✅ ATA Address: DC4nBwHb6z5gAFJmi4Hkhn1TqaVDmhunqktSro16dAod
   ✅ Owner: 5aWw5TTbPDZvcwyy1fR6JLXS9RbG2hDPpzDtrbiEsaN8 (Pool Signer PDA)
   ✅ Ready for cross-chain token operations
```

**Prerequisites:**

- Pool must be initialized first (run `yarn svm:pool:initialize`)
- Wallet must have sufficient SOL balance for transaction fees (minimum 0.01 SOL)
- Token mint must exist and be valid
- Burn-mint pool program must be accessible

**Technical Details:**

- ✅ **Uses Library Functions**: Integrates with `findPoolSignerPDA` from ccip-lib for consistency
- ✅ **Automatic Detection**: Auto-detects token program ID (Token Program vs Token-2022)
- ✅ **Idempotent Operation**: Safely skips creation if account already exists
- ✅ **Proper Ownership**: Creates ATA owned by the pool signer PDA
- ✅ **Transaction Verification**: Confirms successful account creation

**Common Error Resolution:**

This script specifically resolves:

- `AccountNotInitialized` errors during token transfers
- `pool_token_account` related transaction failures
- Missing ATA for pool signer PDA

**After Running This Script:**

- Cross-chain token transfers will work without "AccountNotInitialized" errors
- The pool can hold tokens during CCIP operations
- Ready to proceed with `yarn svm:token-transfer`

#### 2.4. Get Pool Information

The `get-pool-info.ts` script provides comprehensive information about an existing burn-mint token pool. This displays all configuration details, ownership information, and security settings.

```bash
# Get detailed pool information
yarn svm:pool:get-info \
  --token-mint 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY \
  --burn-mint-pool-program 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz

# With debug logging
yarn svm:pool:get-info \
  --token-mint 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY \
  --burn-mint-pool-program 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz \
  --log-level DEBUG
```

##### Required Options

- `--token-mint <address>`: Token mint address to get information for
- `--burn-mint-pool-program <id>`: Burn-mint token pool program ID

##### Optional Options

- `--keypair <path>`: Path to wallet keypair file
- `--log-level <level>`: Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)

##### What This Script Shows

The script provides comprehensive pool information organized into sections:

1. **Basic Information**: Pool type, version, token mint, decimals
2. **Ownership & Permissions**: Current owner, proposed owner, rate limit admin
3. **Token Configuration**: Token program, pool signer PDA, pool token account
4. **CCIP Integration**: Router addresses, onramp authority, RMN remote
5. **Security & Controls**: Allowlist status and entries
6. **Address Summary**: Quick reference for all important addresses

##### Example Output

```
================================================================================
🏊 BURN-MINT TOKEN POOL INFORMATION
================================================================================

📋 BASIC INFORMATION
----------------------------------------
Pool Type: burn-mint
Version: 1
Token Mint: 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY
Decimals: 6

👥 OWNERSHIP & PERMISSIONS
----------------------------------------
Current Owner: EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB
Proposed Owner: 11111111111111111111111111111111 (default/unset)
Rate Limit Admin: EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB

🔒 SECURITY & CONTROLS
----------------------------------------
Allowlist: ❌ Disabled

💡 NEXT STEPS
----------------------------------------
• Configure remote chains for cross-chain transfers
• Set up rate limits for security
• Configure allowlists if needed
• Transfer ownership if this is a temporary deployer
```

**Prerequisites:**

- Pool must be initialized (run `yarn svm:pool:initialize` first)
- Token mint and program ID must be valid

**Use Cases:**

- Verify pool initialization was successful
- Check current ownership and configuration
- Audit security settings before production use
- Get addresses for integration with other tools
- Debug pool-related issues

#### 2.5. Set Pool Router

The `set-router.ts` script sets the configured CCIP router for an existing burn-mint token pool. This is an owner-only operation that ensures the pool uses the correct router for cross-chain operations.

The router address is automatically loaded from the configuration, ensuring consistency with other CCIP scripts and reducing configuration errors.

```bash
# Set the configured CCIP router for the pool
yarn svm:pool:set-router \
  --token-mint 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY \
  --burn-mint-pool-program 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz

# With debug logging
yarn svm:pool:set-router \
  --token-mint 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY \
  --burn-mint-pool-program 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz \
  --log-level DEBUG
```

##### Required Options

- `--token-mint <address>`: Token mint address of the pool
- `--burn-mint-pool-program <id>`: Burn-mint token pool program ID

##### Optional Options

- `--keypair <path>`: Path to wallet keypair file
- `--log-level <level>`: Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip transaction preflight checks

##### What This Script Does

The script performs the following operations:

1. **Configuration Loading**: Loads the CCIP router address from the centralized configuration
2. **Validation**: Checks that the pool exists and displays current configuration
3. **Ownership Check**: Verifies that the wallet is the pool owner
4. **Duplicate Prevention**: Skips operation if router is already set to the configured router
5. **Router Update**: Executes the router change transaction
6. **Verification**: Confirms the router was successfully updated

##### Example Output

```
CCIP Token Pool Set Router

Loading keypair from /Users/user/.config/solana/id.json...
Wallet public key: EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB
Wallet balance: 1.234 SOL
Token Mint: 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY
Burn-Mint Pool Program: 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz
CCIP Router (from config): Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C

Checking if pool exists...
Fetching current pool configuration...
Current router: HrN5BmWXq4CKQVPxZVVqVq8AJpkZvZBsVD23bF4kPq7z
Pool owner: EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB

Setting router to configured CCIP router...
Router updated successfully!
Transaction signature: 3pVb8ifuASvwB3ziqGhYtNrtoYkcqmwJVQQygaAcAP9bY94KRbu5F7173tediMcrLHUKmwu6Ust3NvnAujPTvkSk
Solana Explorer: https://explorer.solana.com/tx/3pVb8ifuASvwB3ziqGhYtNrtoYkcqmwJVQQygaAcAP9bY94KRbu5F7173tediMcrLHUKmwu6Ust3NvnAujPTvkSk?cluster=devnet

Verifying router update...
✅ Router update verified successfully!
Updated router: Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C

💡 View details: yarn svm:pool:get-info --token-mint 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY --burn-mint-pool-program 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz
```

**Prerequisites:**

- Pool must be initialized (run `yarn svm:pool:initialize` first)
- Wallet must be the pool owner
- Wallet must have sufficient SOL balance for transaction fees (minimum 0.01 SOL)

**Important Security Notes:**

- ⚠️ **Owner Only**: Only the pool owner can change the router
- ⚠️ **Configuration Driven**: Router address is loaded from the centralized configuration
- ⚠️ **Consistency**: Ensures the same router is used across all CCIP operations
- ⚠️ **Verification**: Always verify the router change was successful
- ⚠️ **Testing**: Test router changes on devnet before mainnet

**Use Cases:**

- Set the pool router to match the current CCIP configuration
- Fix router configuration issues after pool initialization
- Update router during protocol upgrades
- Ensure consistency with other CCIP operations

**Common Scenarios:**

- `✅ Router is already set to the configured CCIP router`: No change needed
- `Signer is not the owner of the pool`: Only the pool owner can set a router
- `Pool does not exist`: Initialize the pool first using `yarn svm:pool:initialize`

**After Setting Router:**

- Use `yarn svm:pool:get-info` to verify the change
- Test cross-chain operations to ensure router works correctly
- Router should now match the address used by other CCIP scripts

#### 2.6. Get Pool Signer Address

The `get-pool-signer.ts` script retrieves the Program Derived Address (PDA) for a token pool's signer account. This is a **read-only utility** that doesn't require transactions or fees.

```bash
# Get pool signer PDA for a token
yarn svm:pool:get-pool-signer \
  --token-mint 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY \
  --burn-mint-pool-program 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz

# With debug logging
yarn svm:pool:get-pool-signer \
  --token-mint 4yT122YQdx7mdVvoArRgWJpnDbxxWadZpRFHRz2G9SnY \
  --burn-mint-pool-program 4rtU5pVwtQaAfLhd1AkAsL1VopCJciBZewiPgjudeahz \
  --log-level DEBUG
```

##### Required Options

- `--token-mint <address>`: Token mint address
- `--burn-mint-pool-program <id>`: Burn-mint token pool program ID

##### Optional Options

- `--log-level <level>`: Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)

##### What This Script Shows

The script calculates and displays the pool signer PDA address, which is used for:

- Token pool operations and authority
- Cross-chain transfer authorization
- Integration with other CCIP components

**Note:** This is a read-only calculation that doesn't require a wallet, keypair, or network connection.

**Use Cases:**

- Get PDA addresses for integration with other tools
- Verify pool signer addresses during development
- Debug pool configuration issues
- Calculate addresses for off-chain applications

#### 2.7. Initialize Chain Remote Configuration

The `init-chain-remote-config.ts` script initializes a chain remote configuration for a burn-mint token pool, enabling cross-chain token transfers to a specific remote chain.

```bash
# Initialize chain remote configuration
yarn svm:pool:init-chain-remote-config \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \
  --remote-chain ethereum-sepolia \
  --pool-addresses "0x742d35Cc6634C0532925a3b8D5c42A2cDd1e4b6d" \
  --token-address "0xA0b86991c431e59b4b59dac67ba9b82c31a30d15c" \
  --decimals 6

# With debug logging
yarn svm:pool:init-chain-remote-config \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \
  --remote-chain ethereum-sepolia \
  --pool-addresses "0x742d35Cc6634C0532925a3b8D5c42A2cDd1e4b6d" \
  --token-address "0xA0b86991c431e59b4b59dac67ba9b82c31a30d15c" \
  --decimals 6 \
  --log-level DEBUG
```

##### Required Options

- `--token-mint <address>`: Token mint address of existing pool
- `--burn-mint-pool-program <id>`: Burn-mint token pool program ID
- `--remote-chain <chain-id>`: Remote chain to configure (e.g., ethereum-sepolia, base-sepolia)
- `--pool-addresses <addresses>`: Comma-separated pool addresses on remote chain (hex format)
- `--token-address <address>`: Token address on remote chain (hex format)
- `--decimals <number>`: Token decimals on remote chain

##### Optional Options

- `--keypair <path>`: Path to wallet keypair file
- `--log-level <level>`: Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip transaction preflight checks

This script creates a new chain configuration for the specified remote chain. The chain configuration must not already exist for this operation to succeed.

**Prerequisites:**

- Pool must be initialized (run `yarn svm:pool:initialize` first)
- Wallet must be the pool administrator
- Wallet must have sufficient SOL balance for transaction fees (minimum 0.01 SOL)

#### 2.8. Edit Chain Remote Configuration

The `edit-chain-remote-config.ts` script edits an existing chain remote configuration for a burn-mint token pool, updating the configuration for cross-chain token transfers to a specific remote chain.

```bash
# Edit existing chain remote configuration
yarn svm:pool:edit-chain-remote-config \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \
  --remote-chain ethereum-sepolia \
  --pool-addresses "0x742d35Cc6634C0532925a3b8D5c42A2cDd1e4b6d,0x123..." \
  --token-address "0xA0b86991c431e59b4b59dac67ba9b82c31a30d15c" \
  --decimals 6
```

Uses the same options as `init-chain-remote-config` but updates an existing configuration instead of creating a new one. The chain configuration must already exist for this operation to succeed.

#### 2.9. Get Chain Configuration

The `get-chain-config.ts` script retrieves and displays the chain remote configuration for a burn-mint token pool. This is a **read-only operation** that does not require a wallet or keypair.

```bash
# Get chain configuration (read-only)
yarn svm:pool:get-chain-config \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \
  --remote-chain ethereum-sepolia

# With debug logging
yarn svm:pool:get-chain-config \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --burn-mint-pool-program 2YzPLhHBpRMwxCN7yLpHJGHg2AXBzQ5VPuKt51BDKxqh \
  --remote-chain ethereum-sepolia \
  --log-level DEBUG
```

##### Required Options

- `--token-mint <address>`: Token mint address of existing pool
- `--burn-mint-pool-program <id>`: Burn-mint token pool program ID
- `--remote-chain <chain-id>`: Remote chain to query

##### What This Script Shows

- Remote chain decimals and token address
- Pool addresses on the remote chain
- Inbound and outbound rate limit configurations
- Current rate limit usage and timestamps

**Note:** This is a read-only operation that doesn't require a wallet, keypair, or transaction fees.

### 3. Token Admin Registry Management

The Token Admin Registry is a critical component of CCIP that manages administrative permissions for tokens. It allows tokens to register administrators who can control pool settings and cross-chain configurations.

**⚠️ IMPORTANT:** Token admin registry operations follow a **multi-step process**:

1. **Propose Administrator** - Token mint authority proposes a new administrator
2. **Accept Admin Role** - Proposed administrator accepts the role to complete the transfer
3. **Create ALT** - Administrator creates Address Lookup Table with required addresses
4. **Set Pool** - Administrator registers the ALT with the token to enable CCIP operations

#### 3.1. Propose Administrator

The `propose-administrator.ts` script proposes a new administrator for a token's admin registry. Only the token mint authority can execute this operation.

The router address is automatically loaded from the configuration, ensuring consistency with other CCIP scripts and reducing configuration errors.

```bash
# Propose yourself as administrator (most common case)
yarn svm:admin:propose-administrator \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# Propose someone else as administrator
yarn svm:admin:propose-administrator \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --new-admin 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T

# With debug logging
yarn svm:admin:propose-administrator \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --log-level DEBUG
```

##### Required Options

- `--token-mint <address>`: Token mint address

##### Optional Options

- `--new-admin <address>`: Address of the proposed new administrator (defaults to current signer)
- `--keypair <path>`: Path to wallet keypair file
- `--log-level <level>`: Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip transaction preflight checks

##### What This Script Does

The script performs the following operations:

1. **Default Behavior**: If `--new-admin` is not provided, uses the current signer as the proposed administrator
2. **Registry Check**: Checks if a registry already exists and shows current state
3. **Duplicate Prevention**: Skips operation if the proposed admin is already current or pending
4. **Proposal Creation**: Creates or updates the admin registry with the proposed administrator
5. **Verification**: Confirms the proposal was recorded correctly
6. **Next Steps**: Provides guidance for completing the two-step process

##### Example Output

```
CCIP Token Admin Registry Propose Administrator

Loading keypair from /Users/user/.config/solana/id.json...
Wallet public key: EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB
Wallet balance: 1.234 SOL
Token Mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
New Administrator: EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB
  ℹ️ Using current signer as new admin (default behavior)
CCIP Router (from config): Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C

Checking current token admin registry...
No existing token admin registry found
This will create a new registry with the proposed administrator

Proposing new administrator...
Administrator proposed successfully!
Transaction signature: 3pVb8ifuASvwB3ziqGhYtNrtoYkcqmwJVQQygaAcAP9bY94KRbu5F7173tediMcrLHUKmwu6Ust3NvnAujPTvkSk
Solana Explorer: https://explorer.solana.com/tx/3pVb8ifuASvwB3ziqGhYtNrtoYkcqmwJVQQygaAcAP9bY94KRbu5F7173tediMcrLHUKmwu6Ust3NvnAujPTvkSk?cluster=devnet

Verifying administrator proposal...
✅ Administrator proposal verified successfully!
Pending administrator: EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB
Current administrator: 11111111111111111111111111111111

📋 Next Steps:
   1. You (EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB) need to accept the admin role
   2. Use: yarn svm:admin:accept-admin-role --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
   3. You can use the same keypair to accept the role
```

**Prerequisites:**

- Token mint must already exist (use `yarn svm:token:create` to create one)
- Wallet must be the token mint authority
- Wallet must have sufficient SOL balance for transaction fees (minimum 0.01 SOL)

**Important Security Notes:**

- ⚠️ **Mint Authority Only**: Only the token mint authority can propose administrators
- ⚠️ **Configuration Driven**: Router address is loaded from the centralized configuration
- ⚠️ **Two-Step Process**: This is step 1 - the proposed admin must accept the role
- ⚠️ **Self-Proposal**: Most commonly used to propose yourself as the administrator
- ⚠️ **Verification**: Always verify the proposal was recorded correctly

**Use Cases:**

- Set up initial token administration after creating a token
- Transfer administrative control to a different address
- Create admin registry for tokens that will be used in CCIP pools

**Common Scenarios:**

- `✅ The specified address is already the current administrator`: No change needed
- `✅ The specified address is already the pending administrator`: The proposed admin needs to accept
- `No existing token admin registry found`: This will create a new registry

**After Proposing Administrator:**

- The proposed administrator must run `yarn svm:admin:accept-admin-role` to complete the transfer
- Use the registry management features to configure pools and cross-chain settings
- Verify the proposal was successful using registry query tools

#### 3.2. Accept Admin Role

The `accept-admin-role.ts` script accepts the administrator role for a token's admin registry. Only the proposed administrator can execute this operation.

This is step 2 of the two-step administrator transfer process. The current signer must be the pending administrator that was previously proposed.

```bash
# Accept administrator role (you must be the pending administrator)
yarn svm:admin:accept-admin-role \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# With debug logging
yarn svm:admin:accept-admin-role \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --log-level DEBUG
```

##### Required Options

- `--token-mint <address>`: Token mint address

##### Optional Options

- `--keypair <path>`: Path to wallet keypair file
- `--log-level <level>`: Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip transaction preflight checks

##### What This Script Does

The script performs the following operations:

1. **Validation**: Checks that a token admin registry exists for the token
2. **Authority Check**: Verifies that the signer is the pending administrator
3. **State Check**: Ensures the role transfer is valid and needed
4. **Role Acceptance**: Executes the admin role acceptance transaction
5. **Verification**: Confirms the role transfer was completed successfully
6. **Next Steps**: Provides guidance for using the new administrator permissions

##### Example Output

```
CCIP Token Admin Registry Accept Admin Role

Loading keypair from /Users/user/.config/solana/id.json...
Wallet public key: EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB
Wallet balance: 1.234 SOL
Token Mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
Signer (Proposed Admin): EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB
CCIP Router (from config): Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C

Checking current token admin registry...
Current administrator: 11111111111111111111111111111111
Current pending administrator: EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB
Lookup table: 11111111111111111111111111111111

Accepting administrator role...
Administrator role accepted successfully!
Transaction signature: 4mEXMxVoLt6YK8SbujJnqbQpGjL3KXTrzv8VKWzShrN5NiSvLnF7M7vw5BBkUbrwFPtYWVSjYPUYyRGaXfqKBAod
Solana Explorer: https://explorer.solana.com/tx/4mEXMxVoLt6YK8SbujJnqbQpGjL3KXTrzv8VKWzShrN5NiSvLnF7M7vw5BBkUbrwFPtYWVSjYPUYyRGaXfqKBAod?cluster=devnet

Verifying administrator role acceptance...
✅ Administrator role transfer verified successfully!
New administrator: EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB
Pending administrator: 11111111111111111111111111111111 (should be default/cleared)

🎉 Administrator Role Transfer Complete!
   ✅ You are now the administrator for token 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
   ✅ You can now manage pools and cross-chain configurations
   ✅ Use token pool scripts to set up CCIP functionality

📋 Next Steps:
   • Set up token pools if needed
   • Configure cross-chain settings
   • Register pools with the token admin registry
```

**Prerequisites:**

- An administrator must have been proposed first (run `yarn svm:admin:propose-administrator`)
- Wallet must be the pending administrator for the token
- Wallet must have sufficient SOL balance for transaction fees (minimum 0.01 SOL)

**Important Security Notes:**

- ⚠️ **Pending Admin Only**: Only the pending administrator can accept the role
- ⚠️ **Configuration Driven**: Router address is loaded from the centralized configuration
- ⚠️ **Final Step**: This completes the two-step administrator transfer process
- ⚠️ **Verification**: Always verify the role transfer was completed successfully
- ⚠️ **Registry Required**: A token admin registry must exist before accepting

**Use Cases:**

- Complete the administrator role transfer after being proposed
- Take control of token administration for CCIP functionality
- Finalize the setup process for cross-chain token management

**Common Scenarios:**

- `✅ You are already the current administrator`: No change needed
- `Signer is not the pending administrator`: Only the pending admin can accept
- `No token admin registry found`: The admin must be proposed first

**After Accepting Administrator Role:**

- You are now the administrator and can manage the token's CCIP settings
- Set up token pools using `yarn svm:pool:initialize`
- Configure cross-chain settings and rate limits
- Register pools with the token admin registry using `setPool` operations

#### 3.3. Create Address Lookup Table (ALT)

The `create-alt.ts` script creates an Address Lookup Table for a token pool with all necessary addresses required for CCIP token operations. The ALT is essential for efficient cross-chain transactions as it reduces transaction size by allowing address references instead of full public keys.

```bash
# Create ALT for a token pool (most common case)
yarn svm:admin:create-alt \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --pool-program BurnMintTokenPoolProgram111111111111111111

# Create ALT with additional custom addresses
yarn svm:admin:create-alt \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --pool-program BurnMintTokenPoolProgram111111111111111111 \
  --additional-addresses "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA,11111111111111111111111111111112"

# With debug logging for troubleshooting
yarn svm:admin:create-alt \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --pool-program BurnMintTokenPoolProgram111111111111111111 \
  --log-level DEBUG
```

##### Required Options

- `--token-mint <address>`: Token mint address
- `--pool-program <address>`: Pool program ID (e.g., burn-mint pool program)

##### Optional Options

- `--additional-addresses <addresses>`: Comma-separated list of additional addresses to include in the ALT
- `--keypair <path>`: Path to wallet keypair file
- `--log-level <level>`: Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip transaction preflight checks

##### What This Script Does

The script performs the following operations:

1. **Validation**: Checks required arguments and wallet balance
2. **Configuration Loading**: Loads fee quoter and router program IDs from configuration
3. **Token Program Detection**: Automatically detects the token program from on-chain mint data
4. **ALT Creation**: Creates an Address Lookup Table with all required addresses in a single transaction
5. **Address Population**: Includes all 10 base addresses needed for token pool operations
6. **Additional Addresses**: Optionally includes custom addresses specified via --additional-addresses
7. **Verification**: Logs all addresses with descriptions for verification
8. **Next Steps**: Provides exact commands for registering the ALT with setPool

##### ALT Address Contents

The created ALT contains the following addresses in the exact order required by the CCIP router program:

**Base CCIP Addresses (always included):**
- **Index 0**: Lookup table itself
- **Index 1**: Token admin registry PDA
- **Index 2**: Pool program ID
- **Index 3**: Pool configuration PDA
- **Index 4**: Pool token account (ATA)
- **Index 5**: Pool signer PDA
- **Index 6**: Token program ID (auto-detected from on-chain data)
- **Index 7**: Token mint
- **Index 8**: Fee billing token config PDA
- **Index 9**: CCIP router pool signer PDA

**Additional Custom Addresses (optional):**
- **Index 10+**: Custom addresses specified via --additional-addresses (appended in order)

The ALT can contain up to 256 total addresses, allowing for up to 246 additional custom addresses after the 10 base CCIP addresses.

##### Example Output

```
CCIP Token Pool Address Lookup Table Creation

Loading keypair from /Users/user/.config/solana/id.json...
Wallet public key: EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB
Wallet balance: 1.234 SOL
Token Mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
Pool Program: BurnMintTokenPoolProgram111111111111111111
Token Program: Auto-detected from on-chain mint data
Fee Quoter Program: FeeQuoterProgram11111111111111111111111111
Router Program: Ccip842gzYHhvdDkSyi2YVCoAWPbYJoApMFzSxQroE9C

Creating Address Lookup Table...
Address Lookup Table created successfully!
ALT Address: 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T
Transaction signature: 3pVb8ifuASvwB3ziqGhYtNrtoYkcqmwJVQQygaAcAP9bY94KRbu5F7173tediMcrLHUKmwu6Ust3NvnAujPTvkSk
Solana Explorer: https://explorer.solana.com/tx/3pVb8ifuASvwB3ziqGhYtNrtoYkcqmwJVQQygaAcAP9bY94KRbu5F7173tediMcrLHUKmwu6Ust3NvnAujPTvkSk?cluster=devnet

ALT contains 12 addresses:
  [0]: 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T (Lookup table itself)
  [1]: BUGuuhPsHpk8YZrL2GctsCtXGneL1gmT5zYb7eMHZDWf (Token admin registry)
  [2]: BurnMintTokenPoolProgram111111111111111111 (Pool program)
  [3]: H4nMZjCXbLjkMdq3HbDCX7UVVJzFCM3qoGGHgJWJk5Q2 (Pool configuration)
  [4]: 9dZ1KxqT5yvEp8k5F2G3HbDCX7UVVJzFCM3qoGGHgJWJ (Pool token account)
  [5]: 7cA8gBHG5yvEp8k5F2G3HbDCX7UVVJzFCM3qoGGHgJWJ (Pool signer)
  [6]: TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb (Token program)
  [7]: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU (Token mint)
  [8]: FqConfigAddress1111111111111111111111111111 (Fee token config)
  [9]: RouterPoolSignerAddress11111111111111111111 (CCIP router pool signer)
  [10]: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA (Custom address 1)
  [11]: 11111111111111111111111111111112 (Custom address 2)

🎉 ALT Creation Complete!
   ✅ Address Lookup Table: 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T
   ✅ Contains 10 base CCIP addresses for token pool operations
   ✅ Plus 2 additional custom addresses
   ✅ Total addresses: 12
   ✅ Ready to be registered with setPool

📋 Next Steps:
   1. Ensure you are the administrator for token 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
   2. Register this ALT with the token using setPool:
      yarn svm:admin:set-pool \
        --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
        --lookup-table 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T \
        --writable-indices 3,4,5
   3. The token will then be ready for CCIP cross-chain operations
```

**Prerequisites:**

- Token mint must already exist (use `yarn svm:token:create` to create one)
- Wallet must have sufficient SOL balance for transaction fees (minimum 0.01 SOL)
- Pool program ID must be known (usually the burn-mint pool program)

**Important Technical Notes:**

- ⚠️ **Single Transaction**: All addresses (base + additional) are created in one atomic transaction
- ⚠️ **Address Order**: ALT addresses are in the exact order required by the CCIP router program
- ⚠️ **Configuration Driven**: Fee quoter and router program IDs are loaded from configuration
- ⚠️ **Token Program**: Automatically detected from on-chain mint data (no manual specification needed)
- ⚠️ **Writable Indices**: Typically [3, 4, 7] for burn-mint tokens (pool_config, pool_token_account, token_mint)
- ⚠️ **Address Count**: Always contains exactly 10 base addresses + optional additional addresses
- ⚠️ **Capacity Limits**: Maximum 256 total addresses (246 additional after base 10)

**Use Cases:**

- Prepare for token pool registration after becoming administrator
- Create infrastructure needed for CCIP cross-chain operations
- Set up efficient transaction processing for token transfers
- Include additional custom addresses (like multisig addresses) without needing separate extension operations
- Create comprehensive ALTs for complex applications in a single transaction

**After Creating ALT:**

- Use the provided setPool command to register the ALT with the token
- The token will then be enabled for cross-chain operations
- ALT will be used automatically by CCIP send transactions

#### 3.4. Set Pool (Register ALT)

The `set-pool.ts` script registers an Address Lookup Table (ALT) with a token's admin registry, enabling the token for CCIP cross-chain operations. Only the token administrator can execute this operation.

This is the final step in the token admin registry setup process. The ALT must be created first using the create-alt script.

```bash
# Register ALT with token (most common case)
yarn svm:admin:set-pool \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --lookup-table 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T \
  --writable-indices 3,4,7

# With debug logging
yarn svm:admin:set-pool \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --lookup-table 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T \
  --writable-indices 3,4,7 \
  --log-level DEBUG
```

##### Required Options

- `--token-mint <address>`: Token mint address
- `--lookup-table <address>`: Address Lookup Table address (from create-alt script)
- `--writable-indices <indices>`: Comma-separated writable indices (e.g., "3,4,7" for burn-mint tokens)

##### Optional Options

- `--keypair <path>`: Path to wallet keypair file
- `--log-level <level>`: Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip transaction preflight checks

##### What This Script Does

The script performs the following operations:

1. **Validation**: Checks required arguments and wallet balance
2. **Authority Verification**: Ensures signer is the token administrator
3. **ALT Verification**: Confirms the lookup table exists and has sufficient addresses
4. **Duplicate Prevention**: Skips operation if ALT is already registered with the token
5. **Pool Registration**: Registers the ALT with the token admin registry
6. **Verification**: Confirms the registration was completed successfully
7. **Next Steps**: Provides guidance for using the token in CCIP operations

##### Example Output

```
CCIP Token Admin Registry Set Pool

Loading keypair from /Users/user/.config/solana/id.json...
Wallet public key: EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB
Wallet balance: 1.234 SOL
Token Mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
Lookup Table: 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T
Writable Indices: [3, 4, 7]

Checking current token admin registry...
Current administrator: EPUjBP3Xf76K1VKsDSc6GupBWE8uykNksCLJgXZn87CB
Current pending administrator: 11111111111111111111111111111111
Current lookup table: 11111111111111111111111111111111

Verifying lookup table exists...
Lookup table verified with 10 addresses

Setting pool (registering ALT with token)...
Pool set successfully!
Transaction signature: 5xKpVb8ifuASvwB3ziqGhYtNrtoYkcqmwJVQQygaAcAP9bY94KRbu5F7173tediMcrLHUKmwu6Ust3NvnAujPTvkSk
Solana Explorer: https://explorer.solana.com/tx/5xKpVb8ifuASvwB3ziqGhYtNrtoYkcqmwJVQQygaAcAP9bY94KRbu5F7173tediMcrLHUKmwu6Ust3NvnAujPTvkSk?cluster=devnet

Verifying pool registration...
✅ Pool registration verified successfully!
Registered lookup table: 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T
Writable indices: [3, 4, 7]

🎉 Pool Registration Complete!
   ✅ Token: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
   ✅ ALT: 8YHhQnHe4fPvKimt3R4KrvaV9K4d4t1f3KjG2J3RzP8T
   ✅ Ready for CCIP cross-chain operations

📋 Next Steps:
   • The token is now enabled for CCIP transfers
   • Test cross-chain operations using the CCIP router scripts
   • Use yarn svm:token-transfer to send tokens cross-chain
   • Monitor transactions on CCIP Explorer
```

**Prerequisites:**

- Administrator role must be accepted first (run the propose/accept admin scripts)
- ALT must be created first (run `yarn svm:admin:create-alt`)
- Wallet must be the token administrator
- Wallet must have sufficient SOL balance for transaction fees (minimum 0.01 SOL)

**Important Security Notes:**

- ⚠️ **Administrator Only**: Only the token administrator can register ALTs
- ⚠️ **ALT Validation**: Script validates the ALT exists and has required addresses
- ⚠️ **Configuration Driven**: Router address is loaded from the centralized configuration
- ⚠️ **Verification**: Always verify the pool registration was completed successfully
- ⚠️ **Final Step**: This completes the token admin registry setup process

**Use Cases:**

- Enable a token for CCIP cross-chain operations
- Register ALT after administrator setup and ALT creation
- Update or change the ALT associated with a token

**Common Scenarios:**

- `✅ Lookup table is already set to the specified address`: No change needed
- `Signer is not the administrator of this token`: Only the administrator can set pools
- `No token admin registry found`: Complete the administrator setup first
- `Lookup table not found`: Create the ALT first using create-alt script

**After Setting Pool:**

- The token is now fully enabled for CCIP cross-chain operations
- Test token transfers using `yarn svm:token-transfer`
- The ALT will be used automatically for efficient transaction processing
- Monitor transaction status on CCIP Explorer

**Complete Process Summary:**

1. **Create Token**: `yarn svm:token:create`
2. **Propose Admin**: `yarn svm:admin:propose-administrator`
3. **Accept Admin**: `yarn svm:admin:accept-admin-role`
4. **Create ALT**: `yarn svm:admin:create-alt`
5. **Set Pool**: `yarn svm:admin:set-pool` ← You are here
6. **Ready for CCIP**: Use `yarn svm:token-transfer` for cross-chain operations

#### 3.5. Inspect Token Configuration

The `inspect-token.ts` script inspects existing CCIP-enabled tokens to analyze their configuration. This is a **read-only diagnostic tool** that helps validate and compare token configurations with existing tokens to ensure correct setup.

```bash
# Inspect a known CCIP-enabled token
yarn svm:admin:inspect-token \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# With debug logging for detailed analysis
yarn svm:admin:inspect-token \
  --token-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --log-level DEBUG
```

##### Required Options

- `--token-mint <address>`: Token mint address to inspect

##### Optional Options

- `--keypair <path>`: Path to wallet keypair file
- `--log-level <level>`: Log level (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)

##### What This Script Shows

The script provides comprehensive analysis organized into sections:

1. **Token Admin Registry**: Administrator, pending administrator, lookup table
2. **ALT Configuration**: All 10 addresses with their purposes and write permissions
3. **Writable Indices Analysis**: Compares current vs. expected configuration [3, 4, 7] for burn-mint tokens
4. **Validation Checks**: Token mint matching, minimum address requirements
5. **Configuration Summary**: Overall correctness assessment

**Note:** This is a read-only operation that doesn't require wallet permissions or transaction fees.

**Use Cases:**

- Validate configuration of existing CCIP tokens
- Compare writable indices with reference implementations
- Debug token setup issues
- Understand ALT structure for new token configurations
- Verify token admin registry settings

### 4. CCIP Receiver Management

The receiver scripts allow you to deploy and manage CCIP receiver programs that can process incoming cross-chain messages. These are essential for building applications that receive data or tokens from other chains.

#### 4.1. Deploy Receiver Program

The `deploy.ts` script deploys a new CCIP receiver program to handle incoming cross-chain messages.

```bash
# Deploy a new CCIP receiver program
yarn svm:receiver:deploy

# With debug logging
yarn svm:receiver:deploy -- --log-level DEBUG
```

This script:

- Deploys a new receiver program instance
- Sets up the program for incoming CCIP messages
- Returns the program ID for use in initialization

#### 4.2. Initialize Receiver

The `initialize.ts` script initializes a receiver program to start accepting incoming CCIP messages.

```bash
# Initialize receiver for incoming messages
yarn svm:receiver:initialize

# With debug logging
yarn svm:receiver:initialize -- --log-level DEBUG
```

This script:

- Sets up the receiver state account
- Configures the receiver for CCIP message processing
- Prepares storage for incoming message data

#### 4.3. Get Latest Message

The `get-latest-message.ts` script retrieves the latest received cross-chain message from the receiver.

```bash
# Get the latest received message
yarn svm:receiver:get-message

# With debug logging
yarn svm:receiver:get-message -- --log-level DEBUG
```

This script:

- Fetches the most recent incoming message
- Displays message content and metadata
- Shows sender information and chain details

#### 4.4. Close Receiver Storage

The `close-storage.ts` script closes receiver storage accounts to reclaim rent fees.

```bash
# Close receiver storage accounts
yarn svm:receiver:close

# With debug logging
yarn svm:receiver:close -- --log-level DEBUG
```

This script:

- Closes storage accounts when no longer needed
- Reclaims rent fees to the wallet
- Properly cleans up receiver state

**Prerequisites for Receiver Operations:**

- Wallet must have sufficient SOL balance for account creation and rent
- Receiver program must be deployed before initialization
- Initialization must complete before processing messages

### 5. Get CCIP Fee Estimations

The `get-ccip-fee.ts` script provides fee estimations for cross-chain message delivery using CCIP.

#### Usage

You can run the script with Yarn:

```bash
yarn svm:fee [options]
```

Or using ts-node directly:

```bash
yarn ts-node ccip-scripts/svm/router/get-ccip-fee.ts [options]
```

#### Options

- `--network <devnet|mainnet>`: Specify network (default: devnet)
- `--keypair <path>`: Path to keypair file (default: ~/.config/solana/id.json)
- `--use-test-keypair`: Use test keypair at ~/.config/solana/keytest.json
- `--log-level <level>`: Set logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip preflight transaction checks
- `--help` or `-h`: Show usage information

#### Examples

Basic usage with default settings:

```bash
yarn svm:fee
```

With increased log level for debugging:

```bash
yarn svm:fee -- --log-level DEBUG
```

Maximum logging for troubleshooting:

```bash
yarn svm:fee -- --log-level TRACE
```

Using test keypair:

```bash
yarn svm:fee -- --use-test-keypair
```

Skip preflight checks:

```bash
yarn svm:fee -- --skip-preflight
```

#### Fee Token Options

The script uses Wrapped SOL (wSOL) for fee estimations. This is configured in the script to ensure consistent fee calculation with the Solana CCIP implementation.

### 6. Send CCIP Cross-Chain Messages

The `ccip-send.ts` script sends tokens from Solana to Ethereum using Chainlink's CCIP router.

**⚠️ PREREQUISITES:**

1. For non-native fee tokens (LINK, wSOL): Run `yarn svm:token:delegate` first
2. For token transfers: Run `yarn svm:token:delegate` first
3. Ensure you have sufficient SOL for transaction fees
4. Ensure you have sufficient tokens to transfer

#### Usage

Router scripts for different cross-chain operations:

```bash
# Token transfers between chains
yarn svm:token-transfer

# Send arbitrary messages
yarn svm:arbitrary-messaging

# Send both data and tokens
yarn svm:data-and-tokens

# With debug logging (add to any script)
yarn svm:token-transfer -- --log-level DEBUG

# Using test keypair (add to any script)
yarn svm:token-transfer -- --use-test-keypair

# Skip preflight checks (add to any script)
yarn svm:token-transfer -- --skip-preflight
```

Or you can use ts-node directly:

```bash
yarn ts-node ccip-scripts/svm/router/1_token-transfer.ts [options]
yarn ts-node ccip-scripts/svm/router/2_arbitrary-messaging.ts [options]
yarn ts-node ccip-scripts/svm/router/3_data-and-tokens.ts [options]
```

#### Options

- `--network <devnet|mainnet>`: Specify network (default: devnet)
- `--keypair <path>`: Path to keypair file (default: ~/.config/solana/id.json)
- `--use-test-keypair`: Use test keypair at ~/.config/solana/keytest.json
- `--fee-token <token>`: Specify which token to use for paying CCIP fees:
  - `native`: Native SOL (default)
  - `wrapped-native`: Wrapped SOL (WSOL)
  - `link`: Chainlink's LINK token
  - `<ADDRESS>`: Custom token address
- `--log-level <level>`: Set logging verbosity (TRACE, DEBUG, INFO, WARN, ERROR, SILENT)
- `--skip-preflight`: Skip the preflight transaction check (useful for complex transactions)
- `--help` or `-h`: Show usage information

#### Examples

Send tokens between chains:

```bash
yarn svm:token-transfer
```

Send arbitrary messages:

```bash
yarn svm:arbitrary-messaging
```

Send both data and tokens:

```bash
yarn svm:data-and-tokens
```

Send with detailed logging:

```bash
yarn svm:token-transfer -- --log-level DEBUG
```

Send with test keypair:

```bash
yarn svm:token-transfer -- --use-test-keypair
```

Send with custom keypair:

```bash
yarn svm:token-transfer -- --keypair /path/to/keypair.json
```

#### Process Overview

The script:

1. Loads wallet and checks balances
2. Checks token accounts and delegations
3. Calculates CCIP fees
4. Constructs and sends the cross-chain message
5. Returns message ID and transaction details

#### Expected Output

```
==== CCIP Message Sent ====
Transaction signature: 3pVb8ifuASvwB3ziqGhYtNrtoYkcqmwJVQQygaAcAP9bY94KRbu5F7173tediMcrLHUKmwu6Ust3NvnAujPTvkSk
Message ID: 0x3a4e9844d472c33a3edb27bc2a4215bc8f4b3b7c2822c2dd8d4e12ad9cbacf13

Open the CCIP explorer: https://ccip.chain.link/msg/0x3a4e9844d472c33a3edb27bc2a4215bc8f4b3b7c2822c2dd8d4e12ad9cbacf13

View transaction on explorer:
https://explorer.solana.com/tx/3pVb8ifuASvwB3ziqGhYtNrtoYkcqmwJVQQygaAcAP9bY94KRbu5F7173tediMcrLHUKmwu6Ust3NvnAujPTvkSk?cluster=devnet
```

### Keypair Handling

The scripts use the following approach for keypair selection:

1. **Default Behavior**: Uses the standard Solana keypair at `~/.config/solana/id.json`
2. **Custom Keypair**: Specify a custom path with `--keypair <path>`
3. **Test Keypair**: Use the test keypair at `~/.config/solana/keytest.json` with the `--use-test-keypair` flag

### Configuration

The scripts use configuration from `ccip-scripts/config/index.ts` which provides network endpoints and contract addresses.

### Troubleshooting

If you encounter errors:

1. Ensure your wallet has sufficient SOL balance
2. Check that you're connected to the correct network (devnet)
3. Verify your keypair is correctly loaded
4. Increase the log level to DEBUG or TRACE for more information
   ```bash
   yarn svm:fee -- --log-level TRACE
   ```

#### Skip Preflight Option

If you encounter issues with transaction simulation failing, you can use the `--skip-preflight` option:

```bash
yarn svm:token-transfer -- --skip-preflight
# or
yarn svm:fee -- --skip-preflight
```

This bypasses the client-side simulation that happens before sending the transaction, which can be useful for complex transactions that might exceed compute limits during simulation but would work when executed on-chain.

#### Fee Token Recommendations

Based on our testing:

1. **Wrapped SOL** (`--fee-token wrapped-native`): Most reliable option for paying fees
2. **Native SOL** (default): Works in most cases but may have issues with complex transactions
3. **LINK** (`--fee-token link`): Requires having LINK tokens in your wallet and proper delegations

#### Permission Errors

If you see errors like "owner does not match" or permission-related errors:

1. **Make sure** you've run `yarn svm:token:delegate` to grant the necessary permissions
2. Run `yarn svm:token:check` to verify delegations are correctly set
3. If using a non-native fee token, verify it has been delegated to the Fee Billing Signer

#### Common Fee Token Issues

- **Insufficient balance**: Ensure you have enough of the selected fee token
- **Token account not found**: When using tokens other than native SOL, you must have an associated token account
- **Invalid token mint**: Verify the token mint address is correct for the current network

## License

This project is licensed under MIT - see the LICENSE file for details.
