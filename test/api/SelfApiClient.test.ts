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

import {beforeEach, describe, expect, it, vi} from 'vitest'
import {SelfApiClient} from '../../src/api/SelfApiClient.js'
import type {HttpClient} from '../../src/core/HttpClient.js'
import {QualifiedId} from '../../src/model/QualifiedId.js'

describe('SelfApiClient', () => {
  const APP_QUALIFIED_ID = new QualifiedId('app-id', 'wire.com')

  let mockHttpClient: HttpClient
  let selfApiClient: SelfApiClient

  beforeEach(() => {
    mockHttpClient = {
      getRequest: vi.fn()
    } as any

    selfApiClient = new SelfApiClient(mockHttpClient)
  })

  describe('getSelfQualifiedId', () => {
    it('should get the current app qualified id from /self', async () => {
      vi.mocked(mockHttpClient.getRequest).mockResolvedValue({qualified_id: APP_QUALIFIED_ID})

      const result = await selfApiClient.getSelfQualifiedId()

      expect(mockHttpClient.getRequest).toHaveBeenCalledWith('self')
      expect(result).toBe(APP_QUALIFIED_ID)
    })

    it('should propagate errors from getRequest', async () => {
      vi.mocked(mockHttpClient.getRequest).mockRejectedValue(new Error('network-failure'))

      await expect(selfApiClient.getSelfQualifiedId()).rejects.toThrow('network-failure')
    })
  })
})
