import pino from 'pino';
import {type Logger} from '../index.js'

export class PinoLogger implements Logger {
  private pinoLogger: pino.Logger;

  constructor() {
    this.pinoLogger = pino({
      level: 'debug', // DEBUG is better for our use case since we want to see every detail during tests
      transport: {
        target: 'pino-pretty'
      }
    });
  }

  debug(message: string, ...meta: unknown[]): void {
    this.pinoLogger.debug(meta[0] || {}, message);
  }

  info(message: string, ...meta: unknown[]): void {
    this.pinoLogger.info(meta[0] || {}, message);
  }

  warn(message: string, ...meta: unknown[]): void {
    this.pinoLogger.warn(meta[0] || {}, message);
  }

  error(message: string, ...meta: unknown[]): void {
    this.pinoLogger.error(meta[0] || {}, message);
  }
}
