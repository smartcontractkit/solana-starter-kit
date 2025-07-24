/**
 * CCIP EVM CLI Framework
 * 
 * This module provides a unified framework for creating CCIP EVM command-line scripts
 * with consistent argument parsing, error handling, and help formatting.
 * 
 * The framework is designed to be:
 * - Backward compatible with existing CLI interfaces
 * - Type-safe with full TypeScript support
 * - Extensible for script-specific arguments
 * - Consistent in help formatting and error messages
 */

import { LogLevel, createLogger, Logger } from "../../../ccip-lib/evm";
import { CommonOptions } from "./config-parser";

/**
 * Base interface for all CLI command options
 */
export interface BaseCommandOptions extends CommonOptions {
  help?: boolean;
}

/**
 * Interface for defining command-line arguments
 */
export interface ArgumentDefinition {
  /** Argument name (e.g., "fee-token") */
  name: string;
  /** Argument aliases (e.g., ["f", "token"]) */
  aliases?: string[];
  /** Whether this argument is required */
  required?: boolean;
  /** Default value if not provided */
  defaultValue?: any;
  /** Description for help text */
  description: string;
  /** Type of the argument value */
  type: 'string' | 'number' | 'boolean' | 'array';
  /** Example value for help text */
  example?: string;
}

/**
 * Interface for command metadata
 */
export interface CommandMetadata {
  /** Command name (e.g., "token-transfer") */
  name: string;
  /** Brief description of what the command does */
  description: string;
  /** Array of example usage strings */
  examples?: string[];
  /** Additional notes or warnings */
  notes?: string[];
}

/**
 * Abstract base class for CCIP EVM commands
 * 
 * This class provides the foundation for all CCIP EVM scripts with:
 * - Consistent argument parsing and validation
 * - Professional help formatting
 * - Unified error handling
 * - Type-safe option interfaces
 */
export abstract class CCIPCommand<T extends BaseCommandOptions> {
  protected logger: Logger;
  protected options: T;
  private metadata: CommandMetadata;

  constructor(metadata: CommandMetadata) {
    this.metadata = metadata;
    this.logger = createLogger(metadata.name, { level: LogLevel.INFO });
    this.options = {} as T;
  }

  /**
   * Define command-specific arguments
   * Override this method to specify arguments for your command
   */
  protected abstract defineArguments(): ArgumentDefinition[];

  /**
   * Execute the command logic
   * Override this method to implement your command's functionality
   */
  protected abstract execute(): Promise<void>;

  /**
   * Parse common arguments shared across all CCIP scripts
   */
  protected parseCommonArgs(): CommonOptions {
    const args = process.argv.slice(2);
    const options: CommonOptions = {};

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--log-level" && i + 1 < args.length) {
        const level = args[i + 1].toUpperCase();
        switch (level) {
          case "TRACE":
            options.logLevel = LogLevel.TRACE;
            break;
          case "DEBUG":
            options.logLevel = LogLevel.DEBUG;
            break;
          case "INFO":
            options.logLevel = LogLevel.INFO;
            break;
          case "WARN":
            options.logLevel = LogLevel.WARN;
            break;
          case "ERROR":
            options.logLevel = LogLevel.ERROR;
            break;
          default:
            console.warn(`Unknown log level: ${level}, using INFO`);
            options.logLevel = LogLevel.INFO;
        }
        i++; // Skip the next argument
      } else if (args[i] === "--private-key" && i + 1 < args.length) {
        options.privateKey = args[i + 1];
        i++;
      } else if (args[i] === "--fee-token" && i + 1 < args.length) {
        options.feeToken = args[i + 1];
        i++;
      } else if (args[i] === "--token" && i + 1 < args.length) {
        options.token = args[i + 1];
        i++;
      } else if (args[i] === "--amount" && i + 1 < args.length) {
        options.amount = args[i + 1];
        i++;
      } else if (args[i] === "--token-amounts" && i + 1 < args.length) {
        try {
          const tokenAmountsStr = args[i + 1];
          const tokenAmounts = tokenAmountsStr.split(",").map((pair) => {
            const [token, amount] = pair.split(":");
            if (!token || !amount) {
              throw new Error(`Invalid token-amount pair format: ${pair}`);
            }
            return { token, amount };
          });
          options.tokenAmounts = tokenAmounts;
        } catch (error) {
          console.warn("Warning: Failed to parse --token-amounts");
        }
        i++;
      } else if (args[i] === "--receiver" && i + 1 < args.length) {
        options.receiver = args[i + 1];
        i++;
      } else if (args[i] === "--token-receiver" && i + 1 < args.length) {
        options.tokenReceiver = args[i + 1];
        i++;
      } else if (args[i] === "--data" && i + 1 < args.length) {
        const data = args[i + 1];
        options.data = data.startsWith("0x") 
          ? data 
          : "0x" + Buffer.from(data).toString("hex");
        i++;
      } else if (args[i] === "--compute-units" && i + 1 < args.length) {
        options.computeUnits = parseInt(args[i + 1], 10);
        i++;
      } else if (args[i] === "--accounts" && i + 1 < args.length) {
        options.accounts = args[i + 1].split(",");
        i++;
      } else if (args[i] === "--account-is-writable-bitmap" && i + 1 < args.length) {
        options.accountIsWritableBitmap = args[i + 1];
        i++;
      } else if (args[i] === "--chain-id" && i + 1 < args.length) {
        options.chainId = args[i + 1] as any;
        i++;
      }
    }

    // Handle single token to tokenAmounts conversion
    if (options.token && options.amount && !options.tokenAmounts) {
      options.tokenAmounts = [{ token: options.token, amount: options.amount }];
    }

    // Set private key from environment if not provided
    if (!options.privateKey) {
      options.privateKey = process.env.EVM_PRIVATE_KEY;
    }

    return options;
  }

  /**
   * Parse command-line arguments into typed options
   */
  protected parseArguments(): T {
    const commonOptions = this.parseCommonArgs();
    const scriptArguments = this.defineArguments();
    const args = process.argv.slice(2);

    // Start with common options
    let options = { ...commonOptions } as T;

    // Check for help flag
    if (args.includes("--help") || args.includes("-h")) {
      options.help = true;
      return options;
    }

    // Parse script-specific arguments
    for (const argDef of scriptArguments) {
      const argNames = [argDef.name, ...(argDef.aliases || [])];
      let argValue: any = argDef.defaultValue;

      // Find argument in command line
      for (const argName of argNames) {
        const fullArgName = argName.length === 1 ? `-${argName}` : `--${argName}`;
        const argIndex = args.indexOf(fullArgName);
        
        if (argIndex >= 0) {
          if (argDef.type === 'boolean') {
            argValue = true;
          } else if (argIndex + 1 < args.length) {
            const value = args[argIndex + 1];
            
            switch (argDef.type) {
              case 'number':
                argValue = parseFloat(value);
                break;
              case 'array':
                argValue = value.split(',').map(v => v.trim());
                break;
              default:
                argValue = value;
            }
          }
          break;
        }
      }

      // Convert kebab-case to camelCase for property name
      const propName = argDef.name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      (options as any)[propName] = argValue;
    }

    return options;
  }

  /**
   * Display help information for the command
   */
  protected displayHelp(): void {
    console.log(`\n🔧 ${this.metadata.name.toUpperCase()}`);
    console.log("=".repeat(50));
    console.log(this.metadata.description);

    // Common options
    console.log("\n📋 COMMON OPTIONS:");
    console.log("  --private-key <key>           Private key for signing transactions");
    console.log("  --log-level <level>           Log level (TRACE, DEBUG, INFO, WARN, ERROR)");
    console.log("  --fee-token <token>           Token to use for CCIP fees");
    console.log("  --chain-id <id>               Source chain ID");

    // Script-specific arguments
    const scriptArgs = this.defineArguments();
    if (scriptArgs.length > 0) {
      console.log("\n⚙️  COMMAND OPTIONS:");
      for (const arg of scriptArgs) {
        const aliases = arg.aliases ? ` (${arg.aliases.map(a => `-${a}`).join(", ")})` : '';
        const required = arg.required ? ' [REQUIRED]' : '';
        const example = arg.example ? ` (e.g., ${arg.example})` : '';
        console.log(`  --${arg.name}${aliases}${required}`);
        console.log(`      ${arg.description}${example}`);
      }
    }

    // Examples
    if (this.metadata.examples && this.metadata.examples.length > 0) {
      console.log("\n📚 EXAMPLES:");
      this.metadata.examples.forEach(example => {
        console.log(`  ${example}`);
      });
    }

    // Notes
    if (this.metadata.notes && this.metadata.notes.length > 0) {
      console.log("\n📝 NOTES:");
      this.metadata.notes.forEach(note => {
        console.log(`  • ${note}`);
      });
    }

    console.log("\n💡 For more help, check the documentation or use --help");
    console.log("");
  }

  /**
   * Validate required arguments
   */
  protected validateArguments(): void {
    const scriptArgs = this.defineArguments();
    const missingRequired: string[] = [];

    for (const arg of scriptArgs) {
      if (arg.required) {
        const propName = arg.name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        if ((this.options as any)[propName] === undefined) {
          missingRequired.push(arg.name);
        }
      }
    }

    if (missingRequired.length > 0) {
      throw new Error(`Missing required arguments: ${missingRequired.join(', ')}`);
    }

    // Validate private key
    if (!this.options.privateKey) {
      throw new Error("EVM_PRIVATE_KEY must be set in environment variables or provided via --private-key");
    }
  }

  /**
   * Main entry point for running the command
   */
  async run(): Promise<void> {
    try {
      // Parse arguments
      this.options = this.parseArguments();

      // Show help if requested
      if (this.options.help) {
        this.displayHelp();
        return;
      }

      // Update logger level if specified
      if (this.options.logLevel !== undefined) {
        this.logger = createLogger(this.metadata.name, { level: this.options.logLevel });
      }

      // Validate arguments
      this.validateArguments();

      // Execute the command
      await this.execute();

    } catch (error) {
      this.logger.error(`❌ ${this.metadata.name} failed:`);
      if (error instanceof Error) {
        this.logger.error(error.message);
        if (this.options.logLevel && this.options.logLevel <= LogLevel.DEBUG && error.stack) {
          this.logger.debug("\nStack trace:");
          this.logger.debug(error.stack);
        }
      } else {
        this.logger.error(String(error));
      }
      
      this.logger.info("\n💡 Use --help for usage information");
      process.exit(1);
    }
  }
}