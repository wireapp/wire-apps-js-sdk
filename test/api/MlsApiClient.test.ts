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
import {MlsApiClient} from '../../src/api/MlsApiClient.js'

vi.mock('bazinga64', () => ({
  Encoder: {
    toBase64: vi.fn(() => ({asString: 'encoded-key-package'}))
  }
}))

describe('MlsApiClient', () => {
  let mockHttpClient: any
  let mockAppProperties: any
  let client: MlsApiClient

  beforeEach(() => {
    mockHttpClient = {
      getRequest: vi.fn(),
      postRequest: vi.fn(),
    }
    mockAppProperties = {
      getDeviceId: vi.fn(() => 'device-id')
    }

    client = new MlsApiClient(mockHttpClient, mockAppProperties)
  })

  describe('uploadCommitBundle', () => {
    it('should call postRequest without retry policy', async () => {
      const commitBundle = new Uint8Array([1, 2, 3])
      vi.mocked(mockHttpClient.postRequest).mockResolvedValue(undefined)

      await client.uploadCommitBundle(commitBundle)

      expect(mockHttpClient.postRequest).toHaveBeenCalledWith(
        'mls/commit-bundles',
        commitBundle,
        {headerContentType: 'message/mls'}
      )
    })
  })

  describe('sendMessage', () => {
    it('should call postRequest without retry policy', async () => {
      const message = new Uint8Array([4, 5, 6])
      vi.mocked(mockHttpClient.postRequest).mockResolvedValue(undefined)

      await client.sendMessage(message)

      expect(mockHttpClient.postRequest).toHaveBeenCalledWith(
        'mls/messages',
        message,
        {headerContentType: 'message/mls'}
      )
    })
  })

  describe('uploadMlsKeyPackages', () => {
    it('should call postRequest with encoded key packages', async () => {
      const keyPackages = [new Uint8Array([7, 8, 9])]
      vi.mocked(mockHttpClient.postRequest).mockResolvedValue(undefined)

      await client.uploadMlsKeyPackages(keyPackages)

      expect(mockHttpClient.postRequest).toHaveBeenCalledWith(
        'mls/key-packages/self/device-id',
        {key_packages: ['encoded-key-package']}
      )
    })
  })

  describe('getPublicKeys', () => {
    it('should call getRequest with the public keys path', async () => {
      vi.mocked(mockHttpClient.getRequest).mockResolvedValue({})

      await client.getPublicKeys()

      expect(mockHttpClient.getRequest).toHaveBeenCalledWith(
        'mls/public-keys'
      )
    })
  })

  describe('claimKeyPackages', () => {
    it('should call postRequest without retry policy', async () => {
      vi.mocked(mockHttpClient.postRequest).mockResolvedValue({key_packages: []})

      await client.claimKeyPackages('user-id', 'wire.com', '0x0001')

      expect(mockHttpClient.postRequest).toHaveBeenCalledWith(
        'mls/key-packages/claim/wire.com/user-id?ciphersuite=0x0001'
      )
    })
  })
})
