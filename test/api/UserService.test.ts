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
import {UsersApiClient} from '../../src/api/UsersApiClient.js'
import {CryptoProtocol} from '../../src/model/CryptoProtocol.js'
import type {QualifiedId} from "../../src/model/QualifiedId.js";

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

  describe('getUsersClientIds', () => {
    beforeEach(() => {
      mockUsersApiClient.getClientsByUserId = vi.fn()
      mockUsersApiClient.getClientsByUserIds = vi.fn()
    })

    const userId1: QualifiedId = { id: 'user-1', domain: 'example.com' }
    const userId2: QualifiedId = { id: 'user-2', domain: 'example.com' }

    // Use the real static method for key generation in tests
    const toKey = UsersApiClient.toKey;

    it('should call getClientsByUserId when only one user is provided', async () => {
      const mockMap = new Map([[toKey(userId1), [{ id: 'device-1' }]]])
      vi.mocked(mockUsersApiClient.getClientsByUserId).mockResolvedValue(mockMap)

      await service.getUsersClientIds([userId1])

      expect(mockUsersApiClient.getClientsByUserId).toHaveBeenCalledWith(userId1)
      expect(mockUsersApiClient.getClientsByUserIds).not.toHaveBeenCalled()
    })

    it('should call getClientsByUserIds when multiple users are provided', async () => {
      const mockMap = new Map([
        [toKey(userId1), [{ id: 'device-1' }]],
        [toKey(userId2), [{ id: 'device-2' }]]
      ])
      vi.mocked(mockUsersApiClient.getClientsByUserIds).mockResolvedValue(mockMap)

      await service.getUsersClientIds([userId1, userId2])

      expect(mockUsersApiClient.getClientsByUserIds).toHaveBeenCalledWith([userId1, userId2])
      expect(mockUsersApiClient.getClientsByUserId).not.toHaveBeenCalled()
    })

    it('should correctly map single user clients to CryptoClientIds', async () => {
      const mockMap = new Map([[toKey(userId1), [{ id: 'device-1' }, { id: 'device-2' }]]])
      vi.mocked(mockUsersApiClient.getClientsByUserId).mockResolvedValue(mockMap)

      const result = await service.getUsersClientIds([userId1])

      expect(result).toHaveLength(2)
      // Asserting against the value format (adjust if CryptoClientId.create uses different logic)
      expect(result[0].value).toBe('user-1:device-1@example.com')
      expect(result[1].value).toBe('user-1:device-2@example.com')
    })

    it('should correctly map multiple users clients to CryptoClientIds', async () => {
      const mockMap = new Map([
        [toKey(userId1), [{ id: 'device-1' }]],
        [toKey(userId2), [{ id: 'device-2' }, { id: 'device-3' }]]
      ])
      vi.mocked(mockUsersApiClient.getClientsByUserIds).mockResolvedValue(mockMap)

      const result = await service.getUsersClientIds([userId1, userId2])

      expect(result).toHaveLength(3)
      const values = result.map(c => c.value)
      expect(values).toContain('user-1:device-1@example.com')
      expect(values).toContain('user-2:device-2@example.com')
      expect(values).toContain('user-2:device-3@example.com')
    })

    it('should return an empty array when user has no clients', async () => {
      const mockMap = new Map([[toKey(userId1), []]])
      vi.mocked(mockUsersApiClient.getClientsByUserId).mockResolvedValue(mockMap)

      const result = await service.getUsersClientIds([userId1])

      expect(result).toHaveLength(0)
    })

    it('should propagate errors from getClientsByUserId', async () => {
      vi.mocked(mockUsersApiClient.getClientsByUserId).mockRejectedValue(new Error('network-failure'))

      await expect(service.getUsersClientIds([userId1])).rejects.toThrow('network-failure')
    })

    it('should propagate errors from getClientsByUserIds', async () => {
      vi.mocked(mockUsersApiClient.getClientsByUserIds).mockRejectedValue(new Error('network-failure'))

      await expect(service.getUsersClientIds([userId1, userId2])).rejects.toThrow('network-failure')
    })
  })
})
