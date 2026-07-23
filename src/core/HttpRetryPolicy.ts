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

export interface HttpRetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  factor: number
  jitter: boolean
}

export const RETRYABLE_STATUS_CODES = new Set([
  408, // Request Timeout
  425, // Too Early
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504  // Gateway Timeout
])

export const HTTP_RETRY_POLICY: HttpRetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 500,
  maxDelayMs: 1_500,
  factor: 2,
  jitter: true
}
