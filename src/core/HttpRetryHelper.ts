/*
 * Wire
 * Copyright (C) 2026 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 */

import type {HttpRetryPolicy} from './HttpRetryPolicy.js'
import {RETRYABLE_STATUS_CODES} from './HttpRetryPolicy.js'

export class RetryableHttpStatusError extends Error {
  constructor(
    readonly status: number,
    readonly path: string
  ) {
    super(`Retryable HTTP ${status} for ${path}`)
    this.name = 'RetryableHttpStatusError'
  }
}

export class RetryableNetworkError extends Error {
  constructor(
    readonly path: string,
    readonly originalError: unknown
  ) {
    super(`Retryable network error for ${path}`)
    this.name = 'RetryableNetworkError'
  }
}

export function calculateHttpRetryDelay(policy: HttpRetryPolicy, retryAttemptNumber: number): number {
  return policy.baseDelayMs * retryAttemptNumber
}

export function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status)
}

export function isRetryableHttpError(exception: unknown): boolean {
  return exception instanceof RetryableHttpStatusError || exception instanceof RetryableNetworkError
}

export async function waitForHttpRetry(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
}
