import * as loglevel from "loglevel";

/**
 * Log levels available in the CCIP SDK
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  SILENT = 5,
}

/**
 * SDK logging namespace prefix
 */
export const NAMESPACE = "ccip";

/**
 * Logger interface with all available logging methods
 */
export interface Logger {
  trace(...message: any[]): void;
  debug(...message: any[]): void;
  info(...message: any[]): void;
  warn(...message: any[]): void;
  error(...message: any[]): void;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}

/**
 * Logger options for configuration
 */
export interface LoggerOptions {
  level?: LogLevel;
  timestamps?: boolean;
}

/**
 * Default logger options
 */
const DEFAULT_OPTIONS: LoggerOptions = {
  level: LogLevel.INFO,
  timestamps: true,
};

/**
 * Creates a namespaced logger with the given component name
 * @param component Component name to create a logger for
 * @param options Logger configuration options
 * @returns A configured logger instance
 */
export function createLogger(
  component: string,
  options?: LoggerOptions
): Logger {
  const fullOptions = { ...DEFAULT_OPTIONS, ...options };
  const loggerName = component ? `${NAMESPACE}:${component}` : NAMESPACE;

  // Get the underlying loglevel logger
  const baseLogger = loglevel.getLogger(loggerName);

  // Set the initial level
  baseLogger.setLevel(fullOptions.level as unknown as loglevel.LogLevelDesc);

  // Create our wrapper logger with timestamps if enabled
  const logger: Logger = {
    trace: createLogMethod(baseLogger, "trace", fullOptions),
    debug: createLogMethod(baseLogger, "debug", fullOptions),
    info: createLogMethod(baseLogger, "info", fullOptions),
    warn: createLogMethod(baseLogger, "warn", fullOptions),
    error: createLogMethod(baseLogger, "error", fullOptions),

    setLevel(level: LogLevel) {
      baseLogger.setLevel(level as unknown as loglevel.LogLevelDesc);
    },

    getLevel(): LogLevel {
      return baseLogger.getLevel() as unknown as LogLevel;
    },
  };

  return logger;
}

/**
 * Create a log method with optional timestamp
 */
function createLogMethod(
  logger: loglevel.Logger,
  method: "trace" | "debug" | "info" | "warn" | "error",
  options: LoggerOptions
): (...args: any[]) => void {
  return function (...args: any[]) {
    // Skip logging if the current level is higher than this method's level
    const methodLevel = getMethodLogLevel(method);
    const currentLevel = logger.getLevel() as unknown as LogLevel;
    if (methodLevel < currentLevel) {
      return;
    }

    // Use consistent console output for all levels to avoid loglevel conflicts
    if (options.timestamps) {
      const timestamp = new Date().toISOString();

      // Format objects for better readability for trace level
      if (method === "trace") {
        const formattedArgs = args.map((arg) => {
          if (typeof arg === "object" && arg !== null) {
            return JSON.stringify(arg, null, 2);
          }
          return arg;
        });
        console.log(`TRACE: [${timestamp}]`, ...formattedArgs);
      } else {
        // Use regular console for other levels to maintain formatting
        console.log(`[${timestamp}]`, ...args);
      }
    } else {
      // Format objects for better readability for trace level
      if (method === "trace") {
        const formattedArgs = args.map((arg) => {
          if (typeof arg === "object" && arg !== null) {
            return JSON.stringify(arg, null, 2);
          }
          return arg;
        });
        console.log(`TRACE:`, ...formattedArgs);
      } else {
        // Use regular console for other levels
        console.log(...args);
      }
    }
  };
}

/**
 * Convert method name to LogLevel enum value
 */
function getMethodLogLevel(
  method: "trace" | "debug" | "info" | "warn" | "error"
): LogLevel {
  switch (method) {
    case "trace":
      return LogLevel.TRACE;
    case "debug":
      return LogLevel.DEBUG;
    case "info":
      return LogLevel.INFO;
    case "warn":
      return LogLevel.WARN;
    case "error":
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
}

/**
 * Root SDK logger instance
 */
export const rootLogger = createLogger("");

/**
 * Set the global log level for all CCIP loggers
 * @param level The log level to set globally
 */
export function setGlobalLogLevel(level: LogLevel): void {
  loglevel.setLevel(level as unknown as loglevel.LogLevelDesc);
}

/**
 * Reset all loggers to their default levels
 */
export function resetLoggers(): void {
  loglevel.setDefaultLevel(loglevel.levels.INFO);
}
