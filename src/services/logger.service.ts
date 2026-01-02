/**
 * LOGGER SERVICE
 *
 * Centralized logging with file output for errors and audit trails.
 * Supports multiple log levels and structured JSON logging.
 */

import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

class Logger {
  private logDir: string;
  private errorLogPath: string;
  private combinedLogPath: string;
  private minLevel: LogLevel;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor() {
    this.logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    this.errorLogPath = path.join(this.logDir, 'error.log');
    this.combinedLogPath = path.join(this.logDir, 'combined.log');
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.minLevel];
  }

  private formatEntry(entry: LogEntry): string {
    return JSON.stringify(entry) + '\n';
  }

  private async writeToFile(filePath: string, content: string): Promise<void> {
    try {
      fs.appendFileSync(filePath, content, 'utf8');
    } catch (error) {
      console.error(`Failed to write to log file ${filePath}:`, error);
    }
  }

  private async log(level: LogLevel, message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): Promise<void> {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context
    };

    const formatted = this.formatEntry(entry);

    // Console output in development
    if (process.env.NODE_ENV === 'development') {
      const color = this.getColor(level);
      console.log(`${color}[${level.toUpperCase()}]${'\x1b[0m'} ${message}`, context?.metadata || '');
    }

    // Write to combined log
    await this.writeToFile(this.combinedLogPath, formatted);

    // Write errors to separate error log
    if (level === 'error') {
      await this.writeToFile(this.errorLogPath, formatted);
    }
  }

  private getColor(level: LogLevel): string {
    switch (level) {
      case 'debug': return '\x1b[36m'; // Cyan
      case 'info': return '\x1b[32m';  // Green
      case 'warn': return '\x1b[33m';  // Yellow
      case 'error': return '\x1b[31m'; // Red
      default: return '\x1b[0m';
    }
  }

  debug(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Partial<Omit<LogEntry, 'timestamp' | 'level' | 'message'>>): void {
    this.log('error', message, context);
  }

  /**
   * Log an HTTP request error with full context
   */
  logRequestError(
    err: Error & { statusCode?: number; isOperational?: boolean },
    req: { requestId?: string; method?: string; originalUrl?: string; tenant?: { tenantId?: string; userId?: string } },
    statusCode: number
  ): void {
    this.error(`Request failed: ${err.message}`, {
      requestId: req.requestId,
      tenantId: req.tenant?.tenantId,
      userId: req.tenant?.userId,
      method: req.method,
      url: req.originalUrl,
      statusCode,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack
      },
      metadata: {
        isOperational: err.isOperational ?? false
      }
    });
  }

  /**
   * Log an API request completion
   */
  logRequest(
    req: { requestId?: string; method?: string; originalUrl?: string; requestTime?: Date; tenant?: { tenantId?: string; userId?: string } },
    res: { statusCode: number },
    duration: number
  ): void {
    const level: LogLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    this.log(level, `${req.method} ${req.originalUrl} ${res.statusCode}`, {
      requestId: req.requestId,
      tenantId: req.tenant?.tenantId,
      userId: req.tenant?.userId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration
    });
  }
}

// Singleton instance
export const logger = new Logger();
