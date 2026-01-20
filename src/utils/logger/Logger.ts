/**
 * Logger interface for SDK logging dependency injection.
 *
 * Allows consumers to inject their own logging implementation (Winston, Pino, etc.)
 * to capture SDK internal logs.
 *
 * @example
 * // With Pino
 * import pino from 'pino';
 *
 * const pinoInstance = pino({ level: 'debug' });
 *
 * const pinoLogger: Logger = {
 *   debug: (msg, ...meta) => pinoInstance.debug(meta[0] || {}, msg),
 *   info: (msg, ...meta) => pinoInstance.info(meta[0] || {}, msg),
 *   warn: (msg, ...meta) => pinoInstance.warn(meta[0] || {}, msg),
 *   error: (msg, ...meta) => pinoInstance.error(meta[0] || {}, msg),
 * };
 *
 */
export interface Logger {
  debug(message: string, ...meta: unknown[]): void;

  info(message: string, ...meta: unknown[]): void;

  warn(message: string, ...meta: unknown[]): void;

  error(message: string, ...meta: unknown[]): void;
}
