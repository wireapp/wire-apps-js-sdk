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
import {SelfService} from '../../src/api/SelfService.js'
import type {SelfApiClient} from '../../src/api/SelfApiClient.js'
import type {AppProperties} from '../../src/service/AppProperties.js'
import {QualifiedId} from '../../src/model/QualifiedId.js'

describe('SelfService', () => {
  const APP_QUALIFIED_ID = new QualifiedId('app-id', 'wire.com')

  let mockSelfApiClient: SelfApiClient
  let mockAppProperties: AppProperties
  let selfService: SelfService

  beforeEach(() => {
    mockSelfApiClient = {
      getSelfQualifiedId: vi.fn()
    } as any

    mockAppProperties = {
      saveApplicationQualifiedId: vi.fn()
    } as any

    selfService = new SelfService(mockSelfApiClient, mockAppProperties)
  })

  describe('fetchAndSaveSelfCredentials', () => {
    it('should fetch, save, and return the current app qualified id', async () => {
      vi.mocked(mockSelfApiClient.getSelfQualifiedId).mockResolvedValue(APP_QUALIFIED_ID)

      const result = await selfService.fetchAndSaveSelfCredentials()

      expect(mockSelfApiClient.getSelfQualifiedId).toHaveBeenCalled()
      expect(mockAppProperties.saveApplicationQualifiedId).toHaveBeenCalledWith(APP_QUALIFIED_ID)
      expect(result).toBe(APP_QUALIFIED_ID)
    })

    it('should not save when fetching self credentials fails', async () => {
      vi.mocked(mockSelfApiClient.getSelfQualifiedId).mockRejectedValue(new Error('network-failure'))

      await expect(selfService.fetchAndSaveSelfCredentials()).rejects.toThrow('network-failure')

      expect(mockAppProperties.saveApplicationQualifiedId).not.toHaveBeenCalled()
    })
  })
})
