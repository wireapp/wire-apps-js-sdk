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
import {QualifiedId} from '../../src/model/QualifiedId.js'
import {WireUser} from '../../src/model/WireUser.js'
import {TeamId} from '../../src/model/TeamId.js'
import {UserType} from '../../src/model/UserType.js'

describe('UserService', () => {
  let mockUsersApiClient: any
  let mockSearchApiClient: any // Added mock
  let service: UserService

  beforeEach(() => {
    mockUsersApiClient = {
      getUser: vi.fn(),
      listUsers: vi.fn()
    }

    // Initialize the search client mock
    mockSearchApiClient = {
      searchUsers: vi.fn()
    }

    // Pass both mocked dependencies into the service
    service = new UserService(mockUsersApiClient, mockSearchApiClient)

    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  const qualifiedId = {id: 'user-1', domain: 'example.com'}

  const mockUser = {
    qualified_id: qualifiedId,
    name: 'John Doe',
    handle: 'johndoe',
    email: 'john@example.com',
    team: 'team-1',
    supported_protocols: [CryptoProtocol.PROTEUS],
    deleted: false,
    type: UserType.REGULAR
  }

  describe('getUser', () => {
    it('should call usersApiClient.getUser with id and domain', async () => {
      vi.mocked(mockUsersApiClient.getUser).mockResolvedValue(mockUser)

      await service.getUser(qualifiedId)

      expect(mockUsersApiClient.getUser).toHaveBeenCalledWith('user-1', 'example.com')
    })

    it('should return a WireUser mapped from the API response', async () => {
      vi.mocked(mockUsersApiClient.getUser).mockResolvedValue(mockUser)

      const result = await service.getUser(qualifiedId)

      expect(result).toBeInstanceOf(WireUser)
      expect(result.id).toEqual(new QualifiedId('user-1', 'example.com'))
      expect(result.name).toBe('John Doe')
      expect(result.email).toBe('john@example.com')
      expect(result.handle).toBe('johndoe')
      expect(result.teamId).toEqual(new TeamId('team-1'))
      expect(result.deleted).toBe(false)
      expect(result.type).toBe(UserType.REGULAR)
    })

    it('should map undefined optional fields when not present in API response', async () => {
      const minimalUser = {
        qualified_id: qualifiedId,
        name: 'Jane Doe',
        supported_protocols: [CryptoProtocol.PROTEUS],
        deleted: false
      }
      vi.mocked(mockUsersApiClient.getUser).mockResolvedValue(minimalUser)

      const result = await service.getUser(qualifiedId)

      expect(result).toBeInstanceOf(WireUser)
      expect(result.name).toBe('Jane Doe')
      expect(result.deleted).toBe(false)
      expect(result.email).toBeUndefined()
      expect(result.handle).toBeUndefined()
      expect(result.teamId).toBeUndefined()
      expect(result.type).toBeUndefined()
    })

    it('should propagate errors from usersApiClient.getUser', async () => {
      vi.mocked(mockUsersApiClient.getUser).mockRejectedValue(new Error('network-failure'))

      await expect(service.getUser(qualifiedId)).rejects.toThrow('network-failure')
    })
  })

  describe('getUsers', () => {
    const userId1: QualifiedId = {id: 'user-1', domain: 'example.com'}
    const userId2: QualifiedId = {id: 'user-2', domain: 'example.com'}

    const mockListUsersResponse = {
      found: [
        {
          qualified_id: userId1,
          name: 'Alice',
          handle: 'alice',
          email: 'alice@example.com',
          team: 'team-1',
          supported_protocols: [CryptoProtocol.PROTEUS],
          deleted: false,
          type: UserType.REGULAR
        },
        {
          qualified_id: userId2,
          name: 'App',
          handle: 'app_handle',
          supported_protocols: [CryptoProtocol.PROTEUS],
          deleted: false,
          type: UserType.APP
        }
      ]
    }

    it('should call usersApiClient.listUsers with the given user IDs', async () => {
      vi.mocked(mockUsersApiClient.listUsers).mockResolvedValue(mockListUsersResponse)

      await service.getUsers([userId1, userId2])

      expect(mockUsersApiClient.listUsers).toHaveBeenCalledWith([userId1, userId2])
    })

    it('should return WireUser objects mapped from the found list', async () => {
      vi.mocked(mockUsersApiClient.listUsers).mockResolvedValue(mockListUsersResponse)

      const result = await service.getUsers([userId1, userId2])

      expect(result).toHaveLength(2)
      expect(result[0]).toBeInstanceOf(WireUser)
      expect(result[0]!.id).toEqual(new QualifiedId('user-1', 'example.com'))
      expect(result[0]!.name).toBe('Alice')
      expect(result[0]!.type).toBe(UserType.REGULAR)
      expect(result[1]).toBeInstanceOf(WireUser)
      expect(result[1]!.name).toBe('App')
      expect(result[1]!.type).toBe(UserType.APP)
    })

    it('should map type as null when response returns null', async () => {
      vi.mocked(mockUsersApiClient.listUsers).mockResolvedValue({
        found: [{...mockListUsersResponse.found[0]!, type: null}]
      })

      const result = await service.getUsers([userId1])

      expect(result[0]!.type).toBeNull()
    })

    it('should map type as undefined when not present in response', async () => {
      const {type: _, ...userWithoutType} = mockListUsersResponse.found[0]!
      vi.mocked(mockUsersApiClient.listUsers).mockResolvedValue({found: [userWithoutType]})

      const result = await service.getUsers([userId1])

      expect(result[0]!.type).toBeUndefined()
    })

    it('should return an empty array when found list is empty', async () => {
      vi.mocked(mockUsersApiClient.listUsers).mockResolvedValue({found: []})

      const result = await service.getUsers([userId1])

      expect(result).toEqual([])
    })

    it('should propagate errors from usersApiClient.listUsers', async () => {
      vi.mocked(mockUsersApiClient.listUsers).mockRejectedValue(new Error('network-failure'))

      await expect(service.getUsers([userId1])).rejects.toThrow('network-failure')
    })
  })

  describe('getUsersClientIds', () => {
    beforeEach(() => {
      mockUsersApiClient.getClientsByUserIds = vi.fn()
    })

    const userId1: QualifiedId = {id: 'user-1', domain: 'example.com'}
    const userId2: QualifiedId = {id: 'user-2', domain: 'example.com'}

    it('should return empty map when no users provided', async () => {
      const result = await service.getUsersClientIds([])

      expect(result.size).toBe(0)
      expect(mockUsersApiClient.getClientsByUserIds).not.toHaveBeenCalled()
    })

    it('should call getClientsByUserIds for single user', async () => {
      const mockMap = new Map([[QualifiedId.toKey(userId1), [{id: 'device-1'}]]])
      vi.mocked(mockUsersApiClient.getClientsByUserIds).mockResolvedValue(mockMap)

      await service.getUsersClientIds([userId1])

      expect(mockUsersApiClient.getClientsByUserIds).toHaveBeenCalledWith([userId1])
    })

    it('should call getClientsByUserIds when multiple users are provided', async () => {
      const mockMap = new Map([
        [QualifiedId.toKey(userId1), [{id: 'device-1'}]],
        [QualifiedId.toKey(userId2), [{id: 'device-2'}]]
      ])
      vi.mocked(mockUsersApiClient.getClientsByUserIds).mockResolvedValue(mockMap)

      await service.getUsersClientIds([userId1, userId2])

      expect(mockUsersApiClient.getClientsByUserIds).toHaveBeenCalledWith([userId1, userId2])
    })

    it('should return Map with string keys and CryptoClientId arrays as values', async () => {
      const mockMap = new Map([[QualifiedId.toKey(userId1), [{id: 'device-1'}, {id: 'device-2'}]]])
      vi.mocked(mockUsersApiClient.getClientsByUserIds).mockResolvedValue(mockMap)

      const result = await service.getUsersClientIds([userId1])

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(1)

      const key = QualifiedId.toKey(userId1)
      const clientIds = result.get(key)
      expect(clientIds).toBeDefined()
      expect(clientIds).toEqual([
        expect.objectContaining({userId: 'user-1', deviceId: 'device-1', userDomain: 'example.com'}),
        expect.objectContaining({userId: 'user-1', deviceId: 'device-2', userDomain: 'example.com'})
      ])
    })

    it('should correctly map multiple users to their CryptoClientIds with string keys', async () => {
      const mockMap = new Map([
        [QualifiedId.toKey(userId1), [{id: 'device-1'}]],
        [QualifiedId.toKey(userId2), [{id: 'device-2'}, {id: 'device-3'}]]
      ])
      vi.mocked(mockUsersApiClient.getClientsByUserIds).mockResolvedValue(mockMap)

      const result = await service.getUsersClientIds([userId1, userId2])

      expect(result.size).toBe(2)

      const key1 = QualifiedId.toKey(userId1)
      const user1Clients = result.get(key1)
      expect(user1Clients).toEqual([
        expect.objectContaining({userId: 'user-1', deviceId: 'device-1', userDomain: 'example.com'})
      ])

      const key2 = QualifiedId.toKey(userId2)
      const user2Clients = result.get(key2)
      expect(user2Clients).toEqual([
        expect.objectContaining({userId: 'user-2', deviceId: 'device-2', userDomain: 'example.com'}),
        expect.objectContaining({userId: 'user-2', deviceId: 'device-3', userDomain: 'example.com'})
      ])
    })

    it('should return empty map for user with no clients', async () => {
      const mockMap = new Map([[QualifiedId.toKey(userId1), []]])
      vi.mocked(mockUsersApiClient.getClientsByUserIds).mockResolvedValue(mockMap)

      const result = await service.getUsersClientIds([userId1])

      expect(result.size).toBe(0)
    })

    it('should log warning and return empty map when user not in response', async () => {
      const mockMap = new Map() // Empty map - user not returned
      vi.mocked(mockUsersApiClient.getClientsByUserIds).mockResolvedValue(mockMap)

      const result = await service.getUsersClientIds([userId1])

      expect(result.size).toBe(0)
    })

    it('should propagate errors from getClientsByUserIds', async () => {
      vi.mocked(mockUsersApiClient.getClientsByUserIds).mockRejectedValue(new Error('network-failure'))

      await expect(service.getUsersClientIds([userId1, userId2])).rejects.toThrow('network-failure')
    })
  })

  describe('searchUsers', () => {
    const query = 'Alice'
    const domain = 'example.com'

    const mockContactDocument = {
      qualified_id: {id: 'user-alice', domain: 'example.com'},
      name: 'Alice Smith',
      handle: 'alice_s',
      team: 'team-alpha'
    }

    const mockSearchResponse = {
      documents: [mockContactDocument]
    }

    it('should call searchApiClient.searchUsers with query, domain, and numberOfResults', async () => {
      vi.mocked(mockSearchApiClient.searchUsers).mockResolvedValue(mockSearchResponse)

      await service.searchUsers(query, domain, 5)

      expect(mockSearchApiClient.searchUsers).toHaveBeenCalledWith('Alice', 'example.com', 5)
    })

    it('should call searchApiClient.searchUsers with undefined numberOfResults if not provided', async () => {
      vi.mocked(mockSearchApiClient.searchUsers).mockResolvedValue(mockSearchResponse)

      await service.searchUsers(query, domain)

      expect(mockSearchApiClient.searchUsers).toHaveBeenCalledWith('Alice', 'example.com', undefined)
    })

    it('should return an array of WireUser objects mapped from the search response', async () => {
      vi.mocked(mockSearchApiClient.searchUsers).mockResolvedValue(mockSearchResponse)

      const result = await service.searchUsers(query, domain)

      expect(result).toBeInstanceOf(Array)
      expect(result).toHaveLength(1)

      const user = result[0]!
      expect(user).toBeInstanceOf(WireUser)
      expect(user.id).toEqual(new QualifiedId('user-alice', 'example.com'))
      expect(user.name).toBe('Alice Smith')
      expect(user.handle).toBe('alice_s')
      expect(user.teamId).toEqual(new TeamId('team-alpha'))

      // search fields specific mapping assertions
      expect(user.deleted).toBe(false)
      expect(user.email).toBeUndefined()
    })

    it('should map optional missing fields like handle or team to undefined', async () => {
      const minimalContactDocument = {
        qualified_id: {id: 'user-bob', domain: 'example.com'},
        name: 'Bob'
        // handle and team are missing
      }
      vi.mocked(mockSearchApiClient.searchUsers).mockResolvedValue({documents: [minimalContactDocument]})

      const result = await service.searchUsers(query, domain)
      const user = result[0]!

      expect(user.handle).toBeUndefined()
      expect(user.teamId).toBeUndefined()
    })

    it('should return an empty array if search response documents are empty', async () => {
      vi.mocked(mockSearchApiClient.searchUsers).mockResolvedValue({documents: []})

      const result = await service.searchUsers(query, domain)

      expect(result).toEqual([])
    })

    it('should propagate errors from searchApiClient.searchUsers', async () => {
      vi.mocked(mockSearchApiClient.searchUsers).mockRejectedValue(new Error('search-failed'))

      await expect(service.searchUsers(query, domain)).rejects.toThrow('search-failed')
    })
  })
})
