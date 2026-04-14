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
