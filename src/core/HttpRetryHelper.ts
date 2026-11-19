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

/** Stops waiting when aborted; the operation itself must also observe the signal. */
export function withAbortSignal<T>(operation: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return operation
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort)
      reject(signal.reason)
    }
    signal.addEventListener('abort', onAbort, {once: true})
    operation.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
    if (signal.aborted) onAbort()
  })
}

export async function waitForHttpRetry(delayMs: number, signal?: AbortSignal | null): Promise<void> {
  signal?.throwIfAborted()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await withAbortSignal(new Promise<void>((resolve) => (timer = setTimeout(resolve, delayMs))), signal)
  } finally {
    clearTimeout(timer)
  }
}
