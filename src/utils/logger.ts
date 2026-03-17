/**
 * Logger
 * 
 * 統一日誌模組
 * 
 * Validates: Requirements 18.1
 */

/**
 * 日誌等級
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 日誌上下文
 */
export interface LogContext {
  module?: string;
  tool?: string;
  asset?: string;
  workflow?: string;
  [key: string]: unknown;
}

/**
 * 日誌條目
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
}

/**
 * Logger 配置
 */
export interface LoggerConfig {
  level: LogLevel;
  enableTimestamp: boolean;
  enableContext: boolean;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  enableTimestamp: true,
  enableContext: true,
};

/**
 * Logger 類別
 * 
 * 提供統一的日誌記錄功能，支援結構化日誌與上下文
 */
export class Logger {
  private static instance: Logger | null = null;
  private config: LoggerConfig;
  private context: LogContext;

  constructor(config: Partial<LoggerConfig> = {}, context: LogContext = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.context = context;
  }

  /**
   * 取得單例實例
   */
  static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * 重設單例實例（主要用於測試）
   */
  static resetInstance(): void {
    Logger.instance = null;
  }

  /**
   * 建立帶有上下文的子 Logger
   */
  withContext(context: LogContext): Logger {
    return new Logger(this.config, { ...this.context, ...context });
  }

  /**
   * 設定日誌等級
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * 檢查是否應該記錄該等級的日誌
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.level];
  }

  /**
   * 格式化日誌條目
   */
  private formatEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
    const mergedContext = { ...this.context, ...context };
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: Object.keys(mergedContext).length > 0 ? mergedContext : undefined,
    };
  }

  /**
   * 輸出日誌
   */
  private output(entry: LogEntry): void {
    const parts: string[] = [];

    if (this.config.enableTimestamp) {
      parts.push(`[${entry.timestamp}]`);
    }

    parts.push(`[${entry.level.toUpperCase()}]`);
    parts.push(entry.message);

    if (this.config.enableContext && entry.context) {
      parts.push(JSON.stringify(entry.context));
    }

    const output = parts.join(' ');

    switch (entry.level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }

  /**
   * 記錄 debug 等級日誌
   */
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatEntry('debug', message, context));
    }
  }

  /**
   * 記錄 info 等級日誌
   */
  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      this.output(this.formatEntry('info', message, context));
    }
  }

  /**
   * 記錄 warn 等級日誌
   */
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatEntry('warn', message, context));
    }
  }

  /**
   * 記錄 error 等級日誌
   */
  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      this.output(this.formatEntry('error', message, context));
    }
  }
}

/**
 * 預設 Logger 實例
 */
export const logger = Logger.getInstance();
