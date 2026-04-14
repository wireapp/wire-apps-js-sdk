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
import {UserService} from '../../src/api/UserService.js'
import {CryptoProtocol} from '../../src/model/CryptoProtocol.js'

describe('UserService', () => {
  let mockUsersApiClient: any
  let service: UserService

  beforeEach(() => {
    mockUsersApiClient = {
      getUser: vi.fn()
    }

    service = new UserService(mockUsersApiClient)

    vi.spyOn(console, 'info').mockImplementation(() => {
    })
  })

  const qualifiedId = {id: 'user-1', domain: 'example.com'}

  const mockUser = {
    qualified_id: qualifiedId,
    name: 'John Doe',
    handle: 'johndoe',
    email: 'john@example.com',
    team: 'team-1',
    supported_protocols: [CryptoProtocol.PROTEUS],
    deleted: false
  }

  describe('getUser', () => {
    it('should call usersApiClient.getUser with id and domain', async () => {
      vi.mocked(mockUsersApiClient.getUser).mockResolvedValue(mockUser)

      await service.getUser(qualifiedId)

      expect(mockUsersApiClient.getUser).toHaveBeenCalledWith('user-1', 'example.com')
    })

    it('should return the user response', async () => {
      vi.mocked(mockUsersApiClient.getUser).mockResolvedValue(mockUser)

      const result = await service.getUser(qualifiedId)

      expect(result).toEqual(mockUser)
    })

    it('should propagate errors from usersApiClient.getUser', async () => {
      vi.mocked(mockUsersApiClient.getUser).mockRejectedValue(new Error('network-failure'))

      await expect(service.getUser(qualifiedId)).rejects.toThrow('network-failure')
    })
  })

  describe('getUserName', () => {
    it('should return the name of the user', async () => {
      vi.mocked(mockUsersApiClient.getUser).mockResolvedValue(mockUser)

      const result = await service.getUserName(qualifiedId)

      expect(result).toBe('John Doe')
    })

    it('should propagate errors from getUser', async () => {
      vi.mocked(mockUsersApiClient.getUser).mockRejectedValue(new Error('network-failure'))

      await expect(service.getUserName(qualifiedId)).rejects.toThrow('network-failure')
    })
  })
})
