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
import {AppProperties} from '../../src/service/AppProperties.js'
import {AppPropertiesRepository} from '../../src/db/AppPropertiesRepository.js'
import {container} from 'tsyringe'

describe('AppProperties', () => {
  let appProperties: AppProperties
  let mockAppPropertiesRepository: AppPropertiesRepository

  beforeEach(() => {
    container.clearInstances()

    mockAppPropertiesRepository = {
      getByKey: vi.fn(),
      save: vi.fn()
    } as any

    appProperties = new AppProperties(mockAppPropertiesRepository)
  })

  describe('getShouldRejoinConversations', () => {
    it('should return true when value is "1"', () => {
      vi.mocked(mockAppPropertiesRepository.getByKey).mockReturnValue({
        key: 'should_rejoin_conversations',
        value: '1'
      })

      const result = appProperties.getShouldRejoinConversations()

      expect(mockAppPropertiesRepository.getByKey).toHaveBeenCalledWith('should_rejoin_conversations')
      expect(result).toBe(true)
    })

    it('should return false when value is "0"', () => {
      vi.mocked(mockAppPropertiesRepository.getByKey).mockReturnValue({
        key: 'should_rejoin_conversations',
        value: '0'
      })

      const result = appProperties.getShouldRejoinConversations()

      expect(mockAppPropertiesRepository.getByKey).toHaveBeenCalledWith('should_rejoin_conversations')
      expect(result).toBe(false)
    })

    it('should return false when key does not exist', () => {
      vi.mocked(mockAppPropertiesRepository.getByKey).mockReturnValue(null)

      const result = appProperties.getShouldRejoinConversations()

      expect(mockAppPropertiesRepository.getByKey).toHaveBeenCalledWith('should_rejoin_conversations')
      expect(result).toBe(true)
    })

    it('should return false when repository returns undefined', () => {
      vi.mocked(mockAppPropertiesRepository.getByKey).mockReturnValue(undefined)

      const result = appProperties.getShouldRejoinConversations()

      expect(mockAppPropertiesRepository.getByKey).toHaveBeenCalledWith('should_rejoin_conversations')
      expect(result).toBe(true)
    })
  })

  describe('setShouldRejoinConversations', () => {
    it('should save "1" when value is true', () => {
      appProperties.setShouldRejoinConversations(true)

      expect(mockAppPropertiesRepository.save).toHaveBeenCalledWith('should_rejoin_conversations', '1')
    })

    it('should save "0" when value is false', () => {
      appProperties.setShouldRejoinConversations(false)

      expect(mockAppPropertiesRepository.save).toHaveBeenCalledWith('should_rejoin_conversations', '0')
    })
  })

  describe('getDeviceId', () => {
    it('should return the stored device ID', () => {
      vi.mocked(mockAppPropertiesRepository.getByKey).mockReturnValue({
        key: 'device_id',
        value: 'abc123deviceId'
      })

      const result = appProperties.getDeviceId()

      expect(mockAppPropertiesRepository.getByKey).toHaveBeenCalledWith('device_id')
      expect(result).toBe('abc123deviceId')
    })

    it('should return undefined when no device ID is stored', () => {
      vi.mocked(mockAppPropertiesRepository.getByKey).mockReturnValue(undefined)

      const result = appProperties.getDeviceId()

      expect(mockAppPropertiesRepository.getByKey).toHaveBeenCalledWith('device_id')
      expect(result).toBeUndefined()
    })

    it('should return undefined when repository returns null', () => {
      vi.mocked(mockAppPropertiesRepository.getByKey).mockReturnValue(null)

      const result = appProperties.getDeviceId()

      expect(result).toBeUndefined()
    })
  })

  describe('setDeviceId', () => {
    it('should save the device ID as-is', () => {
      appProperties.setDeviceId('abc123deviceId')

      expect(mockAppPropertiesRepository.save).toHaveBeenCalledWith('device_id', 'abc123deviceId')
    })

    it('should overwrite a previously stored device ID', () => {
      appProperties.setDeviceId('first-id')
      appProperties.setDeviceId('second-id')

      expect(mockAppPropertiesRepository.save).toHaveBeenLastCalledWith('device_id', 'second-id')
    })
  })

  describe('round-trip behavior', () => {
    it('should correctly round-trip true value', () => {
      // Set to true
      appProperties.setShouldRejoinConversations(true)
      
      expect(mockAppPropertiesRepository.save).toHaveBeenCalledWith('should_rejoin_conversations', '1')

      // Mock the get to return what was saved
      vi.mocked(mockAppPropertiesRepository.getByKey).mockReturnValue({
        key: 'should_rejoin_conversations',
        value: '1'
      })

      const result = appProperties.getShouldRejoinConversations()
      expect(result).toBe(true)
    })

    it('should correctly round-trip false value', () => {
      // Set to false
      appProperties.setShouldRejoinConversations(false)
      
      expect(mockAppPropertiesRepository.save).toHaveBeenCalledWith('should_rejoin_conversations', '0')

      // Mock the get to return what was saved
      vi.mocked(mockAppPropertiesRepository.getByKey).mockReturnValue({
        key: 'should_rejoin_conversations',
        value: '0'
      })

      const result = appProperties.getShouldRejoinConversations()
      expect(result).toBe(false)
    })
  })
})
