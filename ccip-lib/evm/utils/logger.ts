/**
 * Logging levels for the SDK
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  SILENT = 5
}

/**
 * Logger interface
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
 * Logger options
 */
export interface LoggerOptions {
  /** Log level for the logger */
  level?: LogLevel;
  
  /** Optional prefix for all log messages */
  prefix?: string;
}

/**
 * Creates a new logger instance
 * 
 * @param name Logger name used as prefix for messages
 * @param options Configuration options
 * @returns Logger instance
 */
export function createLogger(name: string, options: LoggerOptions = {}): Logger {
  // Default to INFO level
  let currentLevel = options.level ?? LogLevel.INFO;
  
  // Create prefix for log messages
  const prefix = options.prefix ? `[${name}] [${options.prefix}]` : `[${name}]`;
  
  // Helper to check if a log level should be displayed
  const shouldLog = (level: LogLevel): boolean => level >= currentLevel;
  
  // Create the logger instance
  return {
    trace(...args: any[]): void {
      if (shouldLog(LogLevel.TRACE)) {
        console.trace(prefix, '[TRACE]', ...args);
      }
    },
    
    debug(...args: any[]): void {
      if (shouldLog(LogLevel.DEBUG)) {
        console.debug(prefix, '[DEBUG]', ...args);
      }
    },
    
    info(...args: any[]): void {
      if (shouldLog(LogLevel.INFO)) {
        console.info(prefix, '[INFO]', ...args);
      }
    },
    
    warn(...args: any[]): void {
      if (shouldLog(LogLevel.WARN)) {
        console.warn(prefix, '[WARN]', ...args);
      }
    },
    
    error(...args: any[]): void {
      if (shouldLog(LogLevel.ERROR)) {
        console.error(prefix, '[ERROR]', ...args);
      }
    },
    
    setLevel(level: LogLevel): void {
      currentLevel = level;
    },
    
    getLevel(): LogLevel {
      return currentLevel;
    }
  };
}

/**
 * Returns a string representation of a log level
 * 
 * @param level The log level to convert
 * @returns String representation of the log level
 */
export function logLevelToString(level: LogLevel): string {
  switch (level) {
    case LogLevel.TRACE: return 'TRACE';
    case LogLevel.DEBUG: return 'DEBUG';
    case LogLevel.INFO: return 'INFO';
    case LogLevel.WARN: return 'WARN';
    case LogLevel.ERROR: return 'ERROR';
    case LogLevel.SILENT: return 'SILENT';
    default: return 'UNKNOWN';
  }
}

/**
 * Parses a string to a LogLevel enum value
 * 
 * @param levelStr String representation of log level
 * @param defaultLevel Default level to use if parsing fails
 * @returns The parsed log level or default
 */
export function parseLogLevel(levelStr: string, defaultLevel: LogLevel = LogLevel.INFO): LogLevel {
  const level = levelStr.toUpperCase();
  switch (level) {
    case 'TRACE': return LogLevel.TRACE;
    case 'DEBUG': return LogLevel.DEBUG;
    case 'INFO': return LogLevel.INFO;
    case 'WARN': return LogLevel.WARN;
    case 'ERROR': return LogLevel.ERROR;
    case 'SILENT': return LogLevel.SILENT;
    default: return defaultLevel;
  }
} 