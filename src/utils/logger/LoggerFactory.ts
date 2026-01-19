import type {Logger} from "./Logger.js";
import {DefaultLogger} from "./DefaultLogger.js";

export class LoggerFactory {
  private static rootLogger: Logger;

  static setRootLogger(logger: Logger): void {
    LoggerFactory.rootLogger = logger;
  }

  static getLogger(namespace: string): Logger {
    if (!LoggerFactory.rootLogger) {
      LoggerFactory.rootLogger = new DefaultLogger()
    }

    return {
      debug: (message: string, ...meta: unknown[]) =>
        LoggerFactory.rootLogger.debug(`[${namespace}] ${message}`, ...meta),
      info: (message: string, ...meta: unknown[]) =>
        LoggerFactory.rootLogger.info(`[${namespace}] ${message}`, ...meta),
      warn: (message: string, ...meta: unknown[]) =>
        LoggerFactory.rootLogger.warn(`[${namespace}] ${message}`, ...meta),
      error: (message: string, ...meta: unknown[]) =>
        LoggerFactory.rootLogger.error(`[${namespace}] ${message}`, ...meta),
    };
  }
}
