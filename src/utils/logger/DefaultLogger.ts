import {LogLevel} from "./LogLevel.js";
import type {Logger} from "./Logger.js";

export class DefaultLogger implements Logger {
  constructor(private minLevel: LogLevel = LogLevel.INFO) {
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  debug(message: string, ...meta: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(`[DEBUG] ${message}`, ...meta);
    }
  }

  info(message: string, ...meta: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(`[INFO] ${message}`, ...meta);
    }
  }

  warn(message: string, ...meta: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`[WARN] ${message}`, ...meta);
    }
  }

  error(message: string, ...meta: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`[ERROR] ${message}`, ...meta);
    }
  }
}
