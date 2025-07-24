/**
 * CCIP CLI Framework
 * 
 * This module provides a unified framework for creating CCIP command-line scripts
 * with consistent argument parsing, error handling, and help formatting.
 * 
 * The framework is designed to be:
 * - Backward compatible with existing CLI interfaces
 * - Type-safe with full TypeScript support
 * - Extensible for script-specific arguments
 * - Consistent in help formatting and error messages
 */

import { LogLevel, createLogger, Logger } from "../../../ccip-lib/svm";
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
  /** Argument name (e.g., "token-mint") */
  name: string;
  /** Argument aliases (e.g., ["t", "mint"]) */
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
  /** Command name (e.g., "inspect-token") */
  name: string;
  /** Brief description of what the command does */
  description: string;
  /** Detailed usage examples */
  examples?: string[];
  /** Prerequisites or important notes */
  notes?: string[];
}

/**
 * Abstract base class for CCIP CLI commands
 * 
 * This class provides a consistent framework for building CLI scripts while
 * maintaining backward compatibility with existing argument patterns.
 */
export abstract class CCIPCommand<TOptions extends BaseCommandOptions = BaseCommandOptions> {
  protected logger: Logger;
  protected options: TOptions;

  constructor(protected metadata: CommandMetadata) {
    // Create initial logger (will be updated after parsing options)
    this.logger = createLogger(metadata.name, { level: LogLevel.INFO });
    this.options = {} as TOptions;
  }

  /**
   * Define the arguments this command accepts
   * 
   * Subclasses should override this to define their specific arguments
   */
  protected abstract defineArguments(): ArgumentDefinition[];

  /**
   * Execute the main command logic
   * 
   * Subclasses must implement this method
   */
  protected abstract execute(): Promise<void>;

  /**
   * Parse common arguments shared across all CCIP scripts
   */
  protected parseCommonArgs(): CommonOptions {
    const args = process.argv.slice(2);
    const options: CommonOptions = {
      network: "devnet",
    };

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
          case "SILENT":
            options.logLevel = LogLevel.SILENT;
            break;
          default:
            console.warn(`Unknown log level: ${level}, using INFO`);
            options.logLevel = LogLevel.INFO;
        }
        i++; // Skip the next argument
      } else if (args[i] === "--network" && i + 1 < args.length) {
        const network = args[i + 1].toLowerCase();
        if (network === "devnet" || network === "mainnet") {
          options.network = network;
        } else {
          console.warn(`Unknown network: ${network}, using devnet`);
        }
        i++;
      } else if (args[i] === "--keypair" && i + 1 < args.length) {
        options.keypairPath = args[i + 1];
        i++;
      } else if (args[i] === "--use-test-keypair") {
        options.useTestKeypair = true;
      } else if (args[i] === "--skip-preflight") {
        options.skipPreflight = true;
      }
    }

    return options;
  }

  /**
   * Parse command-specific arguments based on argument definitions
   */
  protected parseSpecificArgs(argDefinitions: ArgumentDefinition[]): Record<string, any> {
    const args = process.argv.slice(2);
    const parsedArgs: Record<string, any> = {};

    // Initialize with default values
    argDefinitions.forEach(def => {
      if (def.defaultValue !== undefined) {
        parsedArgs[def.name] = def.defaultValue;
      }
    });

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      // Check for help flags
      if (arg === "--help" || arg === "-h") {
        parsedArgs.help = true;
        continue;
      }

      // Find matching argument definition
      const argDef = argDefinitions.find(def => {
        const argName = `--${def.name}`;
        const aliases = def.aliases?.map(alias => 
          alias.length === 1 ? `-${alias}` : `--${alias}`
        ) || [];
        
        return arg === argName || aliases.includes(arg);
      });

      if (argDef) {
        // Convert kebab-case to camelCase for property names
        const propertyName = argDef.name.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
        
        if (argDef.type === 'boolean') {
          parsedArgs[propertyName] = true;
        } else if (i + 1 < args.length) {
          const value = args[i + 1];
          
          switch (argDef.type) {
            case 'string':
              parsedArgs[propertyName] = value;
              break;
            case 'number':
              const numValue = Number(value);
              if (isNaN(numValue)) {
                throw new Error(`Invalid number value for --${argDef.name}: ${value}`);
              }
              parsedArgs[propertyName] = numValue;
              break;
            case 'array':
              parsedArgs[propertyName] = value.split(',').map(s => s.trim());
              break;
          }
          i++; // Skip the next argument as it's the value
        }
      }
    }

    return parsedArgs;
  }

  /**
   * Validate that all required arguments are provided
   */
  protected validateRequiredArgs(argDefinitions: ArgumentDefinition[], parsedArgs: Record<string, any>): void {
    const missingArgs = argDefinitions
      .filter(def => {
        const propertyName = def.name.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
        return def.required && (parsedArgs[propertyName] === undefined || parsedArgs[propertyName] === null);
      })
      .map(def => def.name);

    if (missingArgs.length > 0) {
      const missing = missingArgs.map(name => `--${name}`).join(', ');
      throw new Error(`Missing required arguments: ${missing}`);
    }
  }

  /**
   * Print standardized usage information
   */
  protected printStandardUsage(): void {
    const argDefinitions = this.defineArguments();
    
    console.log(`\n${this.metadata.description}\n`);
    console.log(`Usage: yarn svm:${this.metadata.name} [options]\n`);
    
    // Common options section
    console.log("Common Options:");
    console.log("  --network <devnet|mainnet>    Specify network (default: devnet)");
    console.log("  --keypair <path>              Path to keypair file (default: ~/.config/solana/id.json)");
    console.log("  --use-test-keypair            Use test keypair at ~/.config/solana/keytest.json");
    console.log("  --log-level <level>           Log level: TRACE, DEBUG, INFO, WARN, ERROR, SILENT (default: INFO)");
    console.log("  --skip-preflight              Skip preflight transaction checks");
    console.log("  --help, -h                    Show this help message");
    
    // Command-specific options
    if (argDefinitions.length > 0) {
      console.log(`\n${this.metadata.name.charAt(0).toUpperCase() + this.metadata.name.slice(1)} Options:`);
      
      argDefinitions.forEach(def => {
        const argName = `--${def.name}`;
        const aliases = def.aliases?.map(alias => 
          alias.length === 1 ? `-${alias}` : `--${alias}`
        ).join(', ') || '';
        
        const nameWithAliases = aliases ? `${argName}, ${aliases}` : argName;
        const required = def.required ? ' (required)' : '';
        const defaultVal = def.defaultValue !== undefined ? ` (default: ${def.defaultValue})` : '';
        
        console.log(`  ${nameWithAliases.padEnd(30)} ${def.description}${required}${defaultVal}`);
        
        if (def.example) {
          console.log(`${' '.repeat(32)}Example: ${def.example}`);
        }
      });
    }
    
    // Examples section
    if (this.metadata.examples && this.metadata.examples.length > 0) {
      console.log("\nExamples:");
      this.metadata.examples.forEach(example => {
        console.log(`  ${example}`);
      });
    }
    
    // Notes section
    if (this.metadata.notes && this.metadata.notes.length > 0) {
      console.log("\nNotes:");
      this.metadata.notes.forEach(note => {
        console.log(`  • ${note}`);
      });
    }
    
    console.log("");
  }

  /**
   * Run the command with full argument parsing and error handling
   */
  public async run(): Promise<void> {
    try {
      // Parse arguments
      const commonOptions = this.parseCommonArgs();
      const argDefinitions = this.defineArguments();
      const specificArgs = this.parseSpecificArgs(argDefinitions);
      
      // Merge options
      this.options = {
        ...commonOptions,
        ...specificArgs,
      } as TOptions;
      
      // Update logger with parsed log level
      this.logger = createLogger(this.metadata.name, {
        level: this.options.logLevel ?? LogLevel.INFO,
      });
      
      // Handle help flag
      if (this.options.help) {
        this.printStandardUsage();
        process.exit(0);
      }
      
      // Validate required arguments
      this.validateRequiredArgs(argDefinitions, specificArgs);
      
      // Execute the command
      await this.execute();
      
    } catch (error) {
      this.logger.error("\n❌ Command failed:");
      if (error instanceof Error) {
        this.logger.error(error.message);
        if (this.options.logLevel === LogLevel.DEBUG && error.stack) {
          this.logger.error(error.stack);
        }
      } else {
        this.logger.error(String(error));
      }
      
      // Show usage on validation errors
      if (error instanceof Error && error.message.includes("Missing required arguments")) {
        console.log("\nFor help, run with --help flag");
      }
      
      process.exit(1);
    }
  }
}

/**
 * Utility function to create and run a CCIP command
 * 
 * This is a convenience function for simple command creation
 */
export function createCommand<TOptions extends BaseCommandOptions>(
  metadata: CommandMetadata,
  argDefinitions: ArgumentDefinition[],
  executeFunction: (options: TOptions, logger: Logger) => Promise<void>
): CCIPCommand<TOptions> {
  return new class extends CCIPCommand<TOptions> {
    protected defineArguments(): ArgumentDefinition[] {
      return argDefinitions;
    }
    
    protected async execute(): Promise<void> {
      await executeFunction(this.options, this.logger);
    }
  }(metadata);
}