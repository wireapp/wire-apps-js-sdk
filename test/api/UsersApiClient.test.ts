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
import {UsersApiClient} from '../../src/api/UsersApiClient.js'
import {CryptoProtocol} from '../../src/model/CryptoProtocol.js'
import {QualifiedId} from '../../src/model/QualifiedId.js'

describe('UsersApiClient (getUser)', () => {
  let mockHttpClient: any
  let client: UsersApiClient

  beforeEach(() => {
    mockHttpClient = {
      getRequest: vi.fn()
    }

    client = new UsersApiClient(mockHttpClient)

    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  const mockUser = {
    qualified_id: {id: 'userId-1', domain: 'example.com'},
    name: 'John Doe',
    handle: 'johndoe',
    email: 'john@example.com',
    team: 'team-1',
    supported_protocols: [CryptoProtocol.PROTEUS],
    deleted: false
  }

  it('should call httpClient.getRequest with the correct path', async () => {
    vi.mocked(mockHttpClient.getRequest).mockResolvedValue(mockUser)

    await client.getUser('userId-1', 'example.com')

    expect(mockHttpClient.getRequest).toHaveBeenCalledWith('users/example.com/userId-1')
  })

  it('should return the user response from httpClient.getRequest', async () => {
    vi.mocked(mockHttpClient.getRequest).mockResolvedValue(mockUser)

    const result = await client.getUser('userId-1', 'example.com')

    expect(result).toEqual(mockUser)
  })

  it('should return a user without optional fields', async () => {
    const minimalUser = {
      qualified_id: {id: 'userId-2', domain: 'example.com'},
      name: 'Jane Doe',
      supported_protocols: [CryptoProtocol.MLS],
      deleted: false
    }
    vi.mocked(mockHttpClient.getRequest).mockResolvedValue(minimalUser)

    const result = await client.getUser('userId-2', 'example.com')

    expect(result).toEqual(minimalUser)
  })

  it('should return a deleted user', async () => {
    const deletedUser = {...mockUser, deleted: true}
    vi.mocked(mockHttpClient.getRequest).mockResolvedValue(deletedUser)

    const result = await client.getUser('userId-1', 'example.com')

    expect(result.deleted).toBe(true)
  })

  it('should propagate errors from httpClient.getRequest', async () => {
    vi.mocked(mockHttpClient.getRequest).mockRejectedValue(new Error('network-failure'))

    await expect(client.getUser('userId-1', 'example.com')).rejects.toThrow('network-failure')
  })
})

describe('UsersApiClient (getClientsByUserIds)', () => {
  let mockHttpClient: any
  let client: UsersApiClient

  beforeEach(() => {
    mockHttpClient = {
      getRequest: vi.fn(),
      postRequest: vi.fn()
    }

    client = new UsersApiClient(mockHttpClient)
  })

  const userIds: QualifiedId[] = [
    {id: '1d51e2d6-9c70-605f-efc8-ff85c3dabdc7', domain: 'domain1.example.com'},
    {id: '2a62f3e7-0d81-716g-fgd9-gg96d4eced8', domain: 'domain2.example.com'}
  ]

  const mockResponse = {
    qualified_user_map: {
      'domain1.example.com': {
        '1d51e2d6-9c70-605f-efc8-ff85c3dabdc7': [{id: 'd0'}]
      },
      'domain2.example.com': {
        '2a62f3e7-0d81-716g-fgd9-gg96d4eced8': [{id: 'd1'}, {id: 'd2'}]
      }
    }
  }

  it('should call httpClient.postRequest with the correct path and body', async () => {
    vi.mocked(mockHttpClient.postRequest).mockResolvedValue(mockResponse)

    await client.getClientsByUserIds(userIds)

    expect(mockHttpClient.postRequest).toHaveBeenCalledWith('users/list-clients', {qualified_users: userIds})
  })

  it('should correctly parse the qualified_user_map into a Map with string keys', async () => {
    vi.mocked(mockHttpClient.postRequest).mockResolvedValue(mockResponse)

    const result = await client.getClientsByUserIds(userIds)

    expect(result.size).toBe(2)

    const key1 = QualifiedId.toKey(userIds[0]!)
    const key2 = QualifiedId.toKey(userIds[1]!)

    expect(result.get(key1)).toEqual([{id: 'd0'}])
    expect(result.get(key2)).toEqual([{id: 'd1'}, {id: 'd2'}])
  })

  it('should return an empty map when qualified_user_map is empty', async () => {
    vi.mocked(mockHttpClient.postRequest).mockResolvedValue({qualified_user_map: {}})

    const result = await client.getClientsByUserIds(userIds)

    expect(result.size).toBe(0)
  })

  it('should skip domains with undefined users', async () => {
    const responseWithUndefined = {
      qualified_user_map: {
        'domain1.example.com': {
          '1d51e2d6-9c70-605f-efc8-ff85c3dabdc7': [{id: 'd0'}]
        }
      }
    }
    vi.mocked(mockHttpClient.postRequest).mockResolvedValue(responseWithUndefined)

    const result = await client.getClientsByUserIds(userIds)

    expect(result.size).toBe(1)
    expect(result.has(QualifiedId.toKey(userIds[0]!))).toBe(true)
  })

  it('should propagate errors from httpClient.postRequest', async () => {
    vi.mocked(mockHttpClient.postRequest).mockRejectedValue(new Error('network-failure'))

    await expect(client.getClientsByUserIds(userIds)).rejects.toThrow('network-failure')
  })
})

describe('UsersApiClient (listUsers)', () => {
  let mockHttpClient: any
  let client: UsersApiClient

  beforeEach(() => {
    mockHttpClient = {
      postRequest: vi.fn()
    }

    client = new UsersApiClient(mockHttpClient)

    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  const userIds: QualifiedId[] = [
    {id: 'user-1', domain: 'example.com'},
    {id: 'user-2', domain: 'example.com'}
  ]

  const mockFoundUsers = [
    {
      qualified_id: {id: 'user-1', domain: 'example.com'},
      name: 'Alice',
      handle: 'alice',
      email: 'alice@example.com',
      supported_protocols: [CryptoProtocol.PROTEUS],
      deleted: false,
      type: 'regular'
    },
    {
      qualified_id: {id: 'user-2', domain: 'example.com'},
      name: 'Bot',
      handle: 'bot_handle',
      supported_protocols: [CryptoProtocol.PROTEUS],
      deleted: false,
      type: 'bot'
    }
  ]

  it('should call httpClient.postRequest with the correct path and body', async () => {
    vi.mocked(mockHttpClient.postRequest).mockResolvedValue({found: mockFoundUsers})

    await client.listUsers(userIds)

    expect(mockHttpClient.postRequest).toHaveBeenCalledWith('list-users', {qualified_ids: userIds})
  })

  it('should return found users from the response', async () => {
    vi.mocked(mockHttpClient.postRequest).mockResolvedValue({found: mockFoundUsers})

    const result = await client.listUsers(userIds)

    expect(result.found).toHaveLength(2)
    expect(result.found[0]).toEqual(mockFoundUsers[0])
    expect(result.found[1]).toEqual(mockFoundUsers[1])
  })

  it('should include failed users in the response when present', async () => {
    const failedUsers = [{id: 'user-3', domain: 'example.com'}]
    vi.mocked(mockHttpClient.postRequest).mockResolvedValue({found: mockFoundUsers, failed: failedUsers})

    const result = await client.listUsers(userIds)

    expect(result.failed).toEqual(failedUsers)
  })

  it('should return an empty found array when no users are found', async () => {
    vi.mocked(mockHttpClient.postRequest).mockResolvedValue({found: []})

    const result = await client.listUsers(userIds)

    expect(result.found).toHaveLength(0)
  })

  it('should return user with type field when present', async () => {
    vi.mocked(mockHttpClient.postRequest).mockResolvedValue({found: [mockFoundUsers[0]]})

    const result = await client.listUsers(userIds)

    expect(result.found[0]!.type).toBe('regular')
  })

  it('should return user without type field when absent', async () => {
    const {type: _, ...userWithoutType} = mockFoundUsers[0]!
    vi.mocked(mockHttpClient.postRequest).mockResolvedValue({found: [userWithoutType]})

    const result = await client.listUsers(userIds)

    expect(result.found[0]!.type).toBeUndefined()
  })

  it('should propagate errors from httpClient.postRequest', async () => {
    vi.mocked(mockHttpClient.postRequest).mockRejectedValue(new Error('network-failure'))

    await expect(client.listUsers(userIds)).rejects.toThrow('network-failure')
  })
})
