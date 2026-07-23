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

import {afterEach, describe, expect, it, vi} from 'vitest'
import {HTTP_RETRY_POLICY, type HttpRetryPolicy} from '../../src/core/HttpRetryPolicy.js'
import {
  calculateHttpRetryDelay,
  isRetryableHttpError,
  RetryableHttpStatusError,
  RetryableNetworkError
} from '../../src/core/HttpRetryHelper.js'

const RETRY_POLICY_WITHOUT_JITTER: HttpRetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  factor: 2,
  jitter: false
}

const RETRY_POLICY_WITH_JITTER: HttpRetryPolicy = {
  ...RETRY_POLICY_WITHOUT_JITTER,
  jitter: true
}

describe('HttpRetryHelper', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('calculateHttpRetryDelay', () => {
    it('should calculate exponential delay when jitter is disabled', () => {
      expect(calculateHttpRetryDelay(RETRY_POLICY_WITHOUT_JITTER, 0)).toBe(500)
      expect(calculateHttpRetryDelay(RETRY_POLICY_WITHOUT_JITTER, 1)).toBe(1_000)
      expect(calculateHttpRetryDelay(RETRY_POLICY_WITHOUT_JITTER, 2)).toBe(2_000)
      expect(calculateHttpRetryDelay(RETRY_POLICY_WITHOUT_JITTER, 3)).toBe(4_000)
    })

    it('should cap exponential delay at maxDelayMs', () => {
      const policy: HttpRetryPolicy = {
        ...RETRY_POLICY_WITHOUT_JITTER,
        maxDelayMs: 2_000
      }

      expect(calculateHttpRetryDelay(policy, 3)).toBe(2_000)
      expect(calculateHttpRetryDelay(policy, 10)).toBe(2_000)
    })

    it('should use half of calculated delay as the lower jitter bound', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)

      expect(calculateHttpRetryDelay(RETRY_POLICY_WITH_JITTER, 2)).toBe(1_000)
    })

    it('should use calculated delay as the upper jitter bound', () => {
      vi.spyOn(Math, 'random').mockReturnValue(1)

      expect(calculateHttpRetryDelay(RETRY_POLICY_WITH_JITTER, 2)).toBe(2_000)
    })

    it('should apply jitter after maxDelayMs cap', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const policy: HttpRetryPolicy = {
        ...RETRY_POLICY_WITH_JITTER,
        maxDelayMs: 2_000
      }

      expect(calculateHttpRetryDelay(policy, 10)).toBe(1_000)
    })

    it('should keep the default retry policy total delay below five seconds', () => {
      const retryDelays = Array.from(
        {length: HTTP_RETRY_POLICY.maxAttempts - 1},
        (_, retryIndex) => calculateHttpRetryDelay({...HTTP_RETRY_POLICY, jitter: false}, retryIndex)
      )

      expect(retryDelays).toEqual([500, 1_000, 1_500, 1_500])
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
