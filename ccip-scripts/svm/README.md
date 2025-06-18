# CCIP Scripts for Solana

This directory contains scripts for interacting with the Cross-Chain Interoperability Protocol (CCIP) on Solana. These tools help you estimate fees and send cross-chain messages using Chainlink's CCIP infrastructure.

> 📖 **This is the comprehensive technical guide for Solana/SVM operations**  
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

#### 1.1. Wrap SOL to wSOL

The `wrap-sol.ts` script allows you to wrap native SOL into wrapped SOL (wSOL) tokens.

```bash
# Use default keypair
yarn token:wrap

# Specify amount of SOL to wrap
yarn token:wrap -- --amount 2

# Use test keypair
yarn token:wrap:test
```

The script:

- Checks your SOL balance
- Wraps the specified amount (1 SOL by default) into wSOL
- Displays before and after balances

#### 1.2. Delegate Token Authority

The `delegate-token-authority.ts` script delegates token spending authority to the CCIP router's Program Derived Addresses (PDAs).

```bash
# Use default keypair
yarn token:delegate

# Use test keypair
yarn token:delegate:test
```

This script:

- Delegates wSOL to the Fee Billing Signer PDA
- Delegates BnM tokens to the BnM Token Pool Signer PDA
- Delegates LINK tokens to the Fee Billing Signer PDA

**These delegations are necessary for:**

1. Transferring tokens cross-chain via CCIP
2. Using non-native tokens (like wSOL or LINK) to pay for CCIP fees

If you skip this step, your transfers will fail with permission errors.

#### 1.3. Check Token Approvals

The `check-token-approvals.ts` script checks the current delegation status of your token accounts.

```bash
# Use default keypair
yarn token:check

# Use test keypair
yarn token:check:test
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

#### 2.3. Get Pool Information

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

#### 2.4. Set Pool Router

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

### 3. Token Admin Registry Management

The Token Admin Registry is a critical component of CCIP that manages administrative permissions for tokens. It allows tokens to register administrators who can control pool settings and cross-chain configurations.

**⚠️ IMPORTANT:** Token admin registry operations follow a **two-step process**:

1. **Propose Administrator** - Token mint authority proposes a new administrator
2. **Accept Admin Role** - Proposed administrator accepts the role to complete the transfer

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

### 4. Get CCIP Fee Estimations

The `get-ccip-fee.ts` script provides fee estimations for cross-chain message delivery using CCIP.

#### Usage

You can run the script with Yarn:

```bash
yarn ccip:fee [options]
```

Or using ts-node directly:

```bash
yarn ts-node ccip-scripts/router/get-ccip-fee.ts [options]
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
yarn ccip:fee
```

With increased log level for debugging:

```bash
yarn ccip:fee:debug
```

Maximum logging for troubleshooting:

```bash
yarn ccip:fee:trace
```

Using test keypair:

```bash
yarn ccip:fee:test
```

Skip preflight checks:

```bash
yarn ccip:fee:skip
```

#### Fee Token Options

The script uses Wrapped SOL (wSOL) for fee estimations. This is configured in the script to ensure consistent fee calculation with the Solana CCIP implementation.

### 5. Send CCIP Cross-Chain Messages

The `ccip-send.ts` script sends tokens from Solana to Ethereum using Chainlink's CCIP router.

**⚠️ PREREQUISITES:**

1. For non-native fee tokens (LINK, wSOL): Run `yarn token:delegate` first
2. For token transfers: Run `yarn token:delegate` first
3. Ensure you have sufficient SOL for transaction fees
4. Ensure you have sufficient tokens to transfer

#### Usage

We provide several preconfigured commands for different fee token options:

```bash
# Using native SOL as fee token (default)
yarn ccip:send

# Using wrapped SOL as fee token
yarn ccip:send:wrapped

# Using LINK token as fee token
yarn ccip:send:link

# With debug logging
yarn ccip:send:debug

# Using test keypair
yarn ccip:send:test

# Using wrapped SOL and test keypair
yarn ccip:send:wrapped:test

# Skip preflight checks (for complex transactions)
yarn ccip:send:skip
```

Or you can use with custom options:

```bash
yarn ts-node ccip-scripts/router/ccip-send.ts [options]
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

Send with native SOL as the fee token (default):

```bash
yarn ccip:send
```

Send using LINK as the fee token:

```bash
yarn ccip:send:link
```

Send using wrapped SOL as the fee token:

```bash
yarn ccip:send:wrapped
```

Send with detailed logging:

```bash
yarn ccip:send:debug
```

Send with test keypair:

```bash
yarn ccip:send:test
```

Send with custom keypair:

```bash
yarn ccip:send -- --keypair /path/to/keypair.json
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
   yarn ccip:fee:trace
   ```

#### Skip Preflight Option

If you encounter issues with transaction simulation failing, you can use the `--skip-preflight` option:

```bash
yarn ccip:send:skip
# or
yarn ccip:fee:skip
```

This bypasses the client-side simulation that happens before sending the transaction, which can be useful for complex transactions that might exceed compute limits during simulation but would work when executed on-chain.

#### Fee Token Recommendations

Based on our testing:

1. **Wrapped SOL** (`--fee-token wrapped-native`): Most reliable option for paying fees
2. **Native SOL** (default): Works in most cases but may have issues with complex transactions
3. **LINK** (`--fee-token link`): Requires having LINK tokens in your wallet and proper delegations

#### Permission Errors

If you see errors like "owner does not match" or permission-related errors:

1. **Make sure** you've run `yarn token:delegate` to grant the necessary permissions
2. Run `yarn token:check` to verify delegations are correctly set
3. If using a non-native fee token, verify it has been delegated to the Fee Billing Signer

#### Common Fee Token Issues

- **Insufficient balance**: Ensure you have enough of the selected fee token
- **Token account not found**: When using tokens other than native SOL, you must have an associated token account
- **Invalid token mint**: Verify the token mint address is correct for the current network

## License

This project is licensed under MIT - see the LICENSE file for details.
