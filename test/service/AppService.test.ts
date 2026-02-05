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
import {AppService} from '../../src/service/AppService.js'
import {AppRepository} from '../../src/db/AppRepository.js'
import {container} from 'tsyringe'

describe('AppService', () => {
  let appService: AppService
  let mockAppRepository: AppRepository

  beforeEach(() => {
    container.clearInstances()

    mockAppRepository = {
      getByKey: vi.fn(),
      save: vi.fn()
    } as any

    appService = new AppService(mockAppRepository)
  })

  describe('getShouldRejoinConversations', () => {
    it('should return true when value is "1"', () => {
      vi.mocked(mockAppRepository.getByKey).mockReturnValue({
        key: 'should_rejoin_conversations',
        value: '1'
      })

      const result = appService.getShouldRejoinConversations()

      expect(mockAppRepository.getByKey).toHaveBeenCalledWith('should_rejoin_conversations')
      expect(result).toBe(true)
    })

    it('should return false when value is "0"', () => {
      vi.mocked(mockAppRepository.getByKey).mockReturnValue({
        key: 'should_rejoin_conversations',
        value: '0'
      })

      const result = appService.getShouldRejoinConversations()

      expect(mockAppRepository.getByKey).toHaveBeenCalledWith('should_rejoin_conversations')
      expect(result).toBe(false)
    })

    it('should return false when value is undefined', () => {
      vi.mocked(mockAppRepository.getByKey).mockReturnValue({
        key: 'should_rejoin_conversations',
        value: undefined
      })

      const result = appService.getShouldRejoinConversations()

      expect(mockAppRepository.getByKey).toHaveBeenCalledWith('should_rejoin_conversations')
      expect(result).toBe(false)
    })

    it('should return false when key does not exist', () => {
      vi.mocked(mockAppRepository.getByKey).mockReturnValue(null)

      const result = appService.getShouldRejoinConversations()

      expect(mockAppRepository.getByKey).toHaveBeenCalledWith('should_rejoin_conversations')
      expect(result).toBe(false)
    })

    it('should return false when repository returns undefined', () => {
      vi.mocked(mockAppRepository.getByKey).mockReturnValue(undefined)

      const result = appService.getShouldRejoinConversations()

      expect(mockAppRepository.getByKey).toHaveBeenCalledWith('should_rejoin_conversations')
      expect(result).toBe(false)
    })
  })

  describe('setShouldRejoinConversations', () => {
    it('should save "1" when value is true', () => {
      appService.setShouldRejoinConversations(true)

      expect(mockAppRepository.save).toHaveBeenCalledWith('should_rejoin_conversations', '1')
    })

    it('should save "0" when value is false', () => {
      appService.setShouldRejoinConversations(false)

      expect(mockAppRepository.save).toHaveBeenCalledWith('should_rejoin_conversations', '0')
    })
  })

  describe('round-trip behavior', () => {
    it('should correctly round-trip true value', () => {
      // Set to true
      appService.setShouldRejoinConversations(true)
      
      expect(mockAppRepository.save).toHaveBeenCalledWith('should_rejoin_conversations', '1')

      // Mock the get to return what was saved
      vi.mocked(mockAppRepository.getByKey).mockReturnValue({
        key: 'should_rejoin_conversations',
        value: '1'
      })

      const result = appService.getShouldRejoinConversations()
      expect(result).toBe(true)
    })

    it('should correctly round-trip false value', () => {
      // Set to false
      appService.setShouldRejoinConversations(false)
      
      expect(mockAppRepository.save).toHaveBeenCalledWith('should_rejoin_conversations', '0')

      // Mock the get to return what was saved
      vi.mocked(mockAppRepository.getByKey).mockReturnValue({
        key: 'should_rejoin_conversations',
        value: '0'
      })

      const result = appService.getShouldRejoinConversations()
      expect(result).toBe(false)
    })
  })
})
