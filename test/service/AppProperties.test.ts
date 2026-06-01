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
import {AESUtils} from "../../src/utils/AESUtils.js";

const CRYPTO_STORAGE_PASSWORD = 'test-crypto-key-of-32-characters'

describe('AppProperties', () => {
  let appProperties: AppProperties
  let mockAppPropertiesRepository: AppPropertiesRepository

  beforeEach(() => {
    container.clearInstances()

    mockAppPropertiesRepository = {
      getByKey: vi.fn(),
      save: vi.fn()
    } as any

    appProperties = new AppProperties(mockAppPropertiesRepository, CRYPTO_STORAGE_PASSWORD)
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
      vi.mocked(mockAppPropertiesRepository.getByKey).mockReturnValue(undefined)

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

  describe('saveBackendCookieIfMissing', () => {
    const API_TOKEN = 'test-cookie'

    it('should be saved from constructor param when token is not in DB', () => {
      // given
      vi.mocked(mockAppPropertiesRepository.getByKey).mockReturnValue(undefined)

      // when
      appProperties.saveBackendCookieIfMissing(API_TOKEN)

      // then
      expect(mockAppPropertiesRepository.getByKey).toHaveBeenCalledWith('backend_cookie')
      expect(mockAppPropertiesRepository.save).toHaveBeenCalledOnce()
    })

    it('should not overwrite token when one already exists in DB', () => {
      // given
      vi.mocked(mockAppPropertiesRepository.getByKey).mockReturnValue({
        key: 'backend_cookie',
        value: 'encrypted-test-cookie'
      })
      const spy = vi.spyOn(AESUtils, 'decryptData')
      spy.mockImplementationOnce(() => Buffer.from(API_TOKEN))

      // when
      appProperties.saveBackendCookieIfMissing(API_TOKEN)

      // then
      expect(mockAppPropertiesRepository.save).not.toHaveBeenCalled()
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
