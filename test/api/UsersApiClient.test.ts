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
import {UserClientResponse} from "../../src/api/model/UserClientResponse.js";
import type {QualifiedId} from "../../src/model/QualifiedId.js";

describe('UsersApiClient (getUser)', () => {
  let mockHttpClient: any
  let client: UsersApiClient

  beforeEach(() => {
    mockHttpClient = {
      getRequest: vi.fn()
    }

    client = new UsersApiClient(mockHttpClient)

    vi.spyOn(console, 'info').mockImplementation(() => {
    })
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

describe('UsersApiClient (getClientsByUserId)', () => {
  let mockHttpClient: any
  let client: UsersApiClient

  beforeEach(() => {
    mockHttpClient = {
      getRequest: vi.fn()
    }

    client = new UsersApiClient(mockHttpClient)
  })

  const userId: QualifiedId = { id: 'userId-1', domain: 'example.com' }

  const mockClients: UserClientResponse[] = [
    { id: 'd0' },
    { id: 'd1' }
  ]

  it('should call httpClient.getRequest with the correct path', async () => {
    vi.mocked(mockHttpClient.getRequest).mockResolvedValue(mockClients)

    await client.getClientsByUserId(userId)

    expect(mockHttpClient.getRequest).toHaveBeenCalledWith('users/example.com/userId-1/clients')
  })

  it('should return a map with the userId as key and clients as value', async () => {
    vi.mocked(mockHttpClient.getRequest).mockResolvedValue(mockClients)

    const result = await client.getClientsByUserId(userId)

    expect(result.get(userId)).toEqual(mockClients)
  })

  it('should return a map with an empty clients array', async () => {
    vi.mocked(mockHttpClient.getRequest).mockResolvedValue([])

    const result = await client.getClientsByUserId(userId)

    expect(result.get(userId)).toEqual([])
  })

  it('should propagate errors from httpClient.getRequest', async () => {
    vi.mocked(mockHttpClient.getRequest).mockRejectedValue(new Error('network-failure'))

    await expect(client.getClientsByUserId(userId)).rejects.toThrow('network-failure')
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
    { id: '1d51e2d6-9c70-605f-efc8-ff85c3dabdc7', domain: 'domain1.example.com' },
    { id: '2a62f3e7-0d81-716g-fgd9-gg96d4eced8', domain: 'domain2.example.com' }
  ]

  const mockResponse = {
    qualified_user_map: {
      'domain1.example.com': {
        '1d51e2d6-9c70-605f-efc8-ff85c3dabdc7': [{ id: 'd0' }]
      },
      'domain2.example.com': {
        '2a62f3e7-0d81-716g-fgd9-gg96d4eced8': [{ id: 'd1' }, { id: 'd2' }]
      }
    }
  }

  it('should call httpClient.postRequest with the correct path and body', async () => {
    vi.mocked(mockHttpClient.postRequest).mockResolvedValue(mockResponse)

    await client.getClientsByUserIds(userIds)

    expect(mockHttpClient.postRequest).toHaveBeenCalledWith(
      'users/list-clients',
      { qualified_users: userIds }
    )
  })

  it('should correctly parse the qualified_user_map into a Map', async () => {
    vi.mocked(mockHttpClient.postRequest).mockResolvedValue(mockResponse)

    const result = await client.getClientsByUserIds(userIds)

    expect(result.size).toBe(2)

    const entries = Array.from(result.entries())

    const entry1 = entries.find(([k]) => k.id === '1d51e2d6-9c70-605f-efc8-ff85c3dabdc7')
    expect(entry1?.[0].domain).toBe('domain1.example.com')
    expect(entry1?.[1]).toEqual([{ id: 'd0' }])

    const entry2 = entries.find(([k]) => k.id === '2a62f3e7-0d81-716g-fgd9-gg96d4eced8')
    expect(entry2?.[0].domain).toBe('domain2.example.com')
    expect(entry2?.[1]).toEqual([{ id: 'd1' }, { id: 'd2' }])
  })

  it('should return an empty map when qualified_user_map is empty', async () => {
    vi.mocked(mockHttpClient.postRequest).mockResolvedValue({ qualified_user_map: {} })

    const result = await client.getClientsByUserIds(userIds)

    expect(result.size).toBe(0)
  })

  it('should skip domains with undefined users', async () => {
    const responseWithUndefined = {
      qualified_user_map: {
        'domain1.example.com': {
          '1d51e2d6-9c70-605f-efc8-ff85c3dabdc7': [{ id: 'd0' }]
        }
      }
    }
    vi.mocked(mockHttpClient.postRequest).mockResolvedValue(responseWithUndefined)

    const result = await client.getClientsByUserIds(userIds)

    expect(result.size).toBe(1)
  })

  it('should propagate errors from httpClient.postRequest', async () => {
    vi.mocked(mockHttpClient.postRequest).mockRejectedValue(new Error('network-failure'))

    await expect(client.getClientsByUserIds(userIds)).rejects.toThrow('network-failure')
  })
})

