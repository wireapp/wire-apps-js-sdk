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

import {describe, expect, it} from 'vitest'
import {HTTP_RETRY_POLICY, type HttpRetryPolicy} from '../../src/core/HttpRetryPolicy.js'
import {
  calculateHttpRetryDelay,
  isRetryableHttpError,
  RetryableHttpStatusError,
  RetryableNetworkError
} from '../../src/core/HttpRetryHelper.js'

const RETRY_POLICY: HttpRetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 200
}

describe('HttpRetryHelper', () => {
  describe('calculateHttpRetryDelay', () => {
    it('should calculate linear delay', () => {
      expect(calculateHttpRetryDelay(RETRY_POLICY, 1)).toBe(200)
      expect(calculateHttpRetryDelay(RETRY_POLICY, 2)).toBe(400)
      expect(calculateHttpRetryDelay(RETRY_POLICY, 3)).toBe(600)
      expect(calculateHttpRetryDelay(RETRY_POLICY, 4)).toBe(800)
    })

    it('should keep the default retry policy total delay below five seconds', () => {
      const retryDelays = Array.from(
        {length: HTTP_RETRY_POLICY.maxAttempts - 1},
        (_, retryIndex) => calculateHttpRetryDelay(HTTP_RETRY_POLICY, retryIndex + 1)
      )

      expect(retryDelays).toEqual([300, 600, 900, 1200])
      expect(retryDelays.reduce((totalDelay, retryDelay) => totalDelay + retryDelay, 0)).toBeLessThanOrEqual(5_000)
    })
  })

  describe('isRetryableHttpError', () => {
    it('should treat retryable HTTP status errors as retryable', () => {
      expect(isRetryableHttpError(new RetryableHttpStatusError(503, 'feature-configs'))).toBe(true)
    })

    it('should treat wrapped network errors as retryable', () => {
      expect(isRetryableHttpError(new RetryableNetworkError('feature-configs', new TypeError('fetch failed')))).toBe(true)
    })

    it('should not treat arbitrary TypeErrors as retryable', () => {
      expect(isRetryableHttpError(new TypeError('programming error'))).toBe(false)
    })
  })
})
