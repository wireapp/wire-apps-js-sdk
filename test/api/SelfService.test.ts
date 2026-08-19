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
import {TeamId} from '../../src/model/TeamId.js'

describe('SelfService', () => {
  const SELF_RESPONSE = {
    qualified_id: new QualifiedId('app-id', 'wire.com'),
    team: 'team-id'
  }
  const APP_QUALIFIED_ID = new QualifiedId('app-id', 'wire.com')
  const OTHER_APP_QUALIFIED_ID = new QualifiedId('other-app-id', 'wire.com')
  const APP_TEAM_ID = new TeamId('team-id')
  const OTHER_APP_TEAM_ID = new TeamId('other-team-id')

  let mockSelfApiClient: Pick<SelfApiClient, 'getSelf'>
  let mockAppProperties: Pick<
    AppProperties,
    | 'hasApplicationQualifiedId'
    | 'getApplicationQualifiedId'
    | 'saveApplicationQualifiedId'
    | 'hasApplicationTeamId'
    | 'getApplicationTeamId'
    | 'saveApplicationTeamId'
  >
  let selfService: SelfService

  beforeEach(() => {
    mockSelfApiClient = {
      getSelf: vi.fn()
    }

    mockAppProperties = {
      hasApplicationQualifiedId: vi.fn().mockReturnValue(false),
      getApplicationQualifiedId: vi.fn(),
      saveApplicationQualifiedId: vi.fn(),
      hasApplicationTeamId: vi.fn().mockReturnValue(false),
      getApplicationTeamId: vi.fn(),
      saveApplicationTeamId: vi.fn()
    }

    selfService = new SelfService(mockSelfApiClient as SelfApiClient, mockAppProperties as AppProperties)
  })

  describe('fetchAndSaveApplicationData', () => {
    it('should fetch, save, and return the current app qualified id when none is stored', async () => {
      vi.mocked(mockSelfApiClient.getSelf).mockResolvedValue(SELF_RESPONSE)

      const result = await selfService.fetchAndSaveApplicationData()

      expect(mockSelfApiClient.getSelf).toHaveBeenCalled()
      expect(mockAppProperties.hasApplicationQualifiedId).toHaveBeenCalled()
      expect(mockAppProperties.getApplicationQualifiedId).not.toHaveBeenCalled()
      expect(mockAppProperties.saveApplicationQualifiedId).toHaveBeenCalledWith(APP_QUALIFIED_ID)
      expect(mockAppProperties.hasApplicationTeamId).toHaveBeenCalled()
      expect(mockAppProperties.getApplicationTeamId).not.toHaveBeenCalled()
      expect(mockAppProperties.saveApplicationTeamId).toHaveBeenCalledWith(SELF_RESPONSE.team)
      expect(result).toEqual(APP_QUALIFIED_ID)
    })

    it('should not save when the stored application data matches fetched self', async () => {
      vi.mocked(mockSelfApiClient.getSelf).mockResolvedValue(SELF_RESPONSE)
      vi.mocked(mockAppProperties.hasApplicationQualifiedId).mockReturnValue(true)
      vi.mocked(mockAppProperties.getApplicationQualifiedId).mockReturnValue(APP_QUALIFIED_ID)
      vi.mocked(mockAppProperties.hasApplicationTeamId).mockReturnValue(true)
      vi.mocked(mockAppProperties.getApplicationTeamId).mockReturnValue(APP_TEAM_ID)

      const result = await selfService.fetchAndSaveApplicationData()

      expect(mockAppProperties.getApplicationQualifiedId).toHaveBeenCalled()
      expect(mockAppProperties.saveApplicationQualifiedId).not.toHaveBeenCalled()
      expect(mockAppProperties.getApplicationTeamId).toHaveBeenCalled()
      expect(mockAppProperties.saveApplicationTeamId).not.toHaveBeenCalled()
      expect(result).toEqual(APP_QUALIFIED_ID)
    })

    it('should throw when the stored app qualified id differs from fetched self', async () => {
      vi.mocked(mockSelfApiClient.getSelf).mockResolvedValue(SELF_RESPONSE)
      vi.mocked(mockAppProperties.hasApplicationQualifiedId).mockReturnValue(true)
      vi.mocked(mockAppProperties.getApplicationQualifiedId).mockReturnValue(OTHER_APP_QUALIFIED_ID)

      await expect(selfService.fetchAndSaveApplicationData()).rejects.toThrow('Stored application QualifiedId')

      expect(mockAppProperties.saveApplicationQualifiedId).not.toHaveBeenCalled()
    })

    it('should throw when the stored team id differs from fetched self', async () => {
      vi.mocked(mockSelfApiClient.getSelf).mockResolvedValue(SELF_RESPONSE)
      vi.mocked(mockAppProperties.hasApplicationQualifiedId).mockReturnValue(true)
      vi.mocked(mockAppProperties.getApplicationQualifiedId).mockReturnValue(APP_QUALIFIED_ID)
      vi.mocked(mockAppProperties.hasApplicationTeamId).mockReturnValue(true)
      vi.mocked(mockAppProperties.getApplicationTeamId).mockReturnValue(OTHER_APP_TEAM_ID)

      await expect(selfService.fetchAndSaveApplicationData()).rejects.toThrow('Stored application TeamId')

      expect(mockAppProperties.saveApplicationQualifiedId).not.toHaveBeenCalled()
      expect(mockAppProperties.saveApplicationTeamId).not.toHaveBeenCalled()
    })

    it('should not save when fetching application qualified id fails', async () => {
      vi.mocked(mockSelfApiClient.getSelf).mockRejectedValue(new Error('network-failure'))

      await expect(selfService.fetchAndSaveApplicationData()).rejects.toThrow('network-failure')

      expect(mockAppProperties.hasApplicationQualifiedId).not.toHaveBeenCalled()
      expect(mockAppProperties.saveApplicationQualifiedId).not.toHaveBeenCalled()
      expect(mockAppProperties.hasApplicationTeamId).not.toHaveBeenCalled()
      expect(mockAppProperties.saveApplicationTeamId).not.toHaveBeenCalled()
    })
  })
})
