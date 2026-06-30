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
import {SearchApiClient} from '../../src/api/SearchApiClient.js'

describe('SearchApiClient (searchUsers)', () => {
  let mockHttpClient: any
  let client: SearchApiClient

  beforeEach(() => {
    mockHttpClient = {
      getRequest: vi.fn()
    }

    client = new SearchApiClient(mockHttpClient)

    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  it('should call httpClient.getRequest with correct path using default result size', async () => {
    const mockResponse = {documents: [], found: 0, returned: 0, took: 0}
    vi.mocked(mockHttpClient.getRequest).mockResolvedValue(mockResponse)

    await client.searchUsers('alice', 'example.com')

    expect(mockHttpClient.getRequest).toHaveBeenCalledWith(
      'search/contacts?q=alice&domain=example.com&type=regular&size=15'
    )
  })

  it('should call httpClient.getRequest with correct path using custom result size', async () => {
    const mockResponse = {documents: [], found: 0, returned: 0, took: 0}
    vi.mocked(mockHttpClient.getRequest).mockResolvedValue(mockResponse)

    await client.searchUsers('bob', 'wire.com', 50)

    expect(mockHttpClient.getRequest).toHaveBeenCalledWith(
      'search/contacts?q=bob&domain=wire.com&type=regular&size=50'
    )
  })

  it('should return the response from httpClient.getRequest', async () => {
    const mockResponse = {documents: [{id: 'user-1'}], found: 1, returned: 1, took: 5}
    vi.mocked(mockHttpClient.getRequest).mockResolvedValue(mockResponse)

    const result = await client.searchUsers('alice', 'example.com')

    expect(result).toEqual(mockResponse)
  })

  it('should throw when numberOfResults is below minimum (1)', async () => {
    await expect(client.searchUsers('alice', 'example.com', 0)).rejects.toThrow(
      'Number of results value must be between 1 and 500.'
    )
  })

  it('should throw when numberOfResults is above maximum (500)', async () => {
    await expect(client.searchUsers('alice', 'example.com', 501)).rejects.toThrow(
      'Number of results value must be between 1 and 500.'
    )
  })

  it('should accept numberOfResults at the minimum boundary (1)', async () => {
    const mockResponse = {documents: [], found: 0, returned: 0, took: 0}
    vi.mocked(mockHttpClient.getRequest).mockResolvedValue(mockResponse)

    await client.searchUsers('alice', 'example.com', 1)

    expect(mockHttpClient.getRequest).toHaveBeenCalledWith(
      'search/contacts?q=alice&domain=example.com&type=regular&size=1'
    )
  })

  it('should accept numberOfResults at the maximum boundary (500)', async () => {
    const mockResponse = {documents: [], found: 0, returned: 0, took: 0}
    vi.mocked(mockHttpClient.getRequest).mockResolvedValue(mockResponse)

    await client.searchUsers('alice', 'example.com', 500)

    expect(mockHttpClient.getRequest).toHaveBeenCalledWith(
      'search/contacts?q=alice&domain=example.com&type=regular&size=500'
    )
  })

  it('should throw when query is blank', async () => {
    await expect(client.searchUsers('   ', 'example.com')).rejects.toThrow(
      'Search query must not be blank.'
    )
  })

  it('should throw when query is empty string', async () => {
    await expect(client.searchUsers('', 'example.com')).rejects.toThrow(
      'Search query must not be blank.'
    )
  })

  it('should throw when domain is blank', async () => {
    await expect(client.searchUsers('alice', '   ')).rejects.toThrow(
      'Domain must not be blank.'
    )
  })

  it('should throw when domain is empty string', async () => {
    await expect(client.searchUsers('alice', '')).rejects.toThrow(
      'Domain must not be blank.'
    )
  })

  it('should propagate errors from httpClient.getRequest', async () => {
    vi.mocked(mockHttpClient.getRequest).mockRejectedValue(new Error('network-failure'))

    await expect(client.searchUsers('alice', 'example.com')).rejects.toThrow('network-failure')
  })

  it('should not call httpClient.getRequest when validation fails', async () => {
    await expect(client.searchUsers('', 'example.com')).rejects.toThrow()

    expect(mockHttpClient.getRequest).not.toHaveBeenCalled()
  })
})
