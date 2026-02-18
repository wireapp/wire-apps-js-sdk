/*
* Wire
* Copyright (C) 2025 Wire Swiss GmbH
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

import {beforeEach, describe, expect, test, vi} from 'vitest'
import {AssetsApiClient} from "../../src/api/AssetsApiClient.js";
import {container} from "tsyringe";
import {AssetsTransferService} from "../../src/api/AssetsTransferService.js";
import type {AssetRemoteData} from "../../src/model/WireMessage.js";
import {HashUtils} from "../../src/utils/HashUtils.js";
import {AESUtils} from "../../src/utils/AESUtils.js";
import {ETERNAL_INFREQUENT_ACCESS} from "../../src/api/model/asset/AssetRetention.js";
import crypto from "crypto";

describe('AssetTransferService', () => {
  let assetTransferService: AssetsTransferService
  let mockAssetsApiClient: AssetsApiClient;

  const KEY_MATERIAL = crypto.randomBytes(32)

  beforeEach(() => {
    container.clearInstances()

    mockAssetsApiClient = {
      downloadAsset: vi.fn(),
      uploadAsset: vi.fn()
    } as any

    vi.spyOn(AESUtils, 'generateRandomAES256Key').mockReturnValue({
      algorithm: 0,
      keyMaterial: KEY_MATERIAL
    })

    assetTransferService = new AssetsTransferService(mockAssetsApiClient)
  })

  describe("given asset download succeeds", () => {
    test("when hashes match, then decrypted asset is returned", async () => {
      // Arrange
      const plainData = Buffer.from([1, 2, 3])
      const decipherKey = KEY_MATERIAL
      const encryptedAsset = AESUtils.encryptData(plainData, decipherKey)
      const assetRemoteData: AssetRemoteData = {
        assetId: 'test-asset-id',
        assetDomain: 'test-domain.com',
        sha256: HashUtils.calculateSha256Hash(encryptedAsset),
        otrKey: decipherKey
      }
      vi.mocked(mockAssetsApiClient.downloadAsset).mockResolvedValue(encryptedAsset)

      // Act
      const result = await assetTransferService.downloadAsset(assetRemoteData)

      // Assert
      expect(Array.from(result)).toEqual(Array.from(plainData))
    })

    test("when hash value doesn't match, then exception is thrown", async () => {
      // Arrange
      const encryptedAsset = new Uint8Array([1, 2, 3])
      const maliciousAsset = new Uint8Array([4, 5, 6])
      const assetRemoteData: AssetRemoteData = {
        assetId: 'test-asset-id',
        assetDomain: 'test-domain.com',
        sha256: HashUtils.calculateSha256Hash(encryptedAsset),
        otrKey: new Uint8Array(),
      }
      vi.mocked(mockAssetsApiClient.downloadAsset).mockResolvedValue(maliciousAsset)

      // Act & Assert
      await expect(assetTransferService.downloadAsset(assetRemoteData)).rejects.toThrowError()
    })
  })

  describe("given valid asset", () => {
    test('when uploaded, then it should be encrypted', async () => {
      // Arrange
      const assetData = new Uint8Array([1, 2, 3])
      const mockEncryptedAsset = Buffer.from([99, 88, 77, 66, 55])
      const mockUploadResponse = {
        key: 'asset-id-123',
        token: 'asset-token-456',
        domain: 'example.com'
      }

      vi.mocked(mockAssetsApiClient.uploadAsset).mockResolvedValue(mockUploadResponse)
      vi.spyOn(AESUtils, 'encryptData').mockReturnValue(mockEncryptedAsset)

      // Act
      const result = await assetTransferService.uploadAssetForSending(assetData)

      // Assert
      expect(AESUtils.generateRandomAES256Key).toHaveBeenCalledOnce()
      expect(AESUtils.encryptData).toHaveBeenCalledWith(assetData, KEY_MATERIAL)
      expect(mockAssetsApiClient.uploadAsset).toHaveBeenCalledWith(
        mockEncryptedAsset,
        {
          retention: ETERNAL_INFREQUENT_ACCESS,
          public: false
        }
      )
      expect(result.sha256).toEqual(HashUtils.calculateSha256Hash(mockEncryptedAsset))
      expect(result.otrKey).toEqual(KEY_MATERIAL)
    })
  })
})
