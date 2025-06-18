import { createLogger } from '../../../ccip-lib/svm/utils/logger';

const logger = createLogger('ArgsParser');

/**
 * Argument definition type
 */
export interface ArgDefinition {
  name: string;
  description: string;
  required: boolean;
  type?: 'string' | 'number' | 'boolean';
  default?: any;
}

/**
 * Parse command line arguments based on provided definitions
 * @param definitions Array of argument definitions
 * @returns Object containing parsed arguments
 */
export function parseArgs(definitions: ArgDefinition[]): Record<string, any> {
  const args = process.argv.slice(2);
  const result: Record<string, any> = {};
  
  // First, initialize with default values
  definitions.forEach(def => {
    if (def.default !== undefined) {
      result[def.name] = def.default;
    }
  });
  
  // Parse CLI arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const argName = arg.substring(2);
      const def = definitions.find(d => d.name === argName);
      
      if (def && i + 1 < args.length) {
        let value: any = args[i + 1];
        
        // Skip arguments that start with '--'
        if (value.startsWith('--')) {
          // Boolean arguments can be specified without a value
          if (def.type === 'boolean') {
            result[def.name] = true;
            continue; // Don't increment i
          } else {
            throw new Error(`Missing value for argument: ${def.name}`);
          }
        }
        
        // Parse value according to type
        if (def.type === 'number') {
          value = Number(value);
          if (isNaN(value)) {
            throw new Error(`Invalid number for argument: ${def.name}`);
          }
        } else if (def.type === 'boolean') {
          value = value === 'true';
        }
        
        result[def.name] = value;
        i++; // Skip the value
      }
    }
  }
  
  // Check for required arguments
  const missingArgs = definitions
    .filter(def => def.required && result[def.name] === undefined)
    .map(def => def.name);
  
  if (missingArgs.length > 0) {
    logger.error(`Missing required arguments: ${missingArgs.join(', ')}`);
    console.log('\nUsage:');
    definitions.forEach(def => {
      console.log(`  --${def.name} ${def.type || 'string'} ${def.required ? '(required)' : '(optional)'}: ${def.description}`);
    });
    process.exit(1);
  }
  
  return result;
} 