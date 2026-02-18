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

import { singleton } from "tsyringe";
import { AssetsApiClient } from "./AssetsApiClient.js";
import type { AssetRemoteData } from "../model/WireMessage.js";
import { AESUtils } from "../utils/AESUtils.js";
import { HashUtils } from "../utils/HashUtils.js";
import type { AssetUploadData } from "./model/asset/AssetUploadData.js";
import { obfuscateId } from "../utils/ObfuscateUtil.js";
import type { AssetUploadResponse } from "./model/asset/AssetUploadResponse.js";
import { ETERNAL_INFREQUENT_ACCESS } from "./model/asset/AssetRetention.js";

@singleton()
export class AssetsTransferService {
  constructor(private assetsApiClient: AssetsApiClient) {
  }

  private readonly MAX_DATA_SIZE = 100 * 1024 * 1024

  async downloadAsset(assetRemoteData: AssetRemoteData): Promise<Uint8Array> {
    const encryptedAsset: Uint8Array = await this.assetsApiClient.downloadAsset(
      assetRemoteData.assetId,
      assetRemoteData.assetDomain,
      assetRemoteData.assetToken
    )

    const calculatedSha256 = HashUtils.calculateSha256Hash(encryptedAsset)
    if (!HashUtils.isHashEqual(assetRemoteData.sha256, calculatedSha256)) {
      // TODO: Map to WireException
      throw new Error(`The sha256 doesn't match for asset with ID ${obfuscateId(assetRemoteData.assetId)}`)
    }

    return AESUtils.decryptData(encryptedAsset, assetRemoteData.otrKey)
  }

  async uploadAssetForSending(
    asset: Uint8Array
  ): Promise<AssetRemoteData> {
    const cryptoKeyInfo = AESUtils.generateRandomAES256Key()
    const encryptedAsset = AESUtils.encryptData(asset, cryptoKeyInfo.keyMaterial)
    const assetUploadData = {
      retention: ETERNAL_INFREQUENT_ACCESS,
      public: false
    }

    const assetUploadResponse = await this.uploadAsset(
      encryptedAsset,
      assetUploadData
    )

    return {
      otrKey: cryptoKeyInfo.keyMaterial,
      encryptionAlgorithm: cryptoKeyInfo.algorithm,
      sha256: HashUtils.calculateSha256Hash(encryptedAsset),
      assetId: assetUploadResponse.key,
      assetToken: assetUploadResponse.token ?? null,
      assetDomain: assetUploadResponse.domain
    }
  }

  private async uploadAsset(
    asset: Uint8Array,
    assetUploadData: AssetUploadData
  ): Promise<AssetUploadResponse> {
    if (asset.length > this.MAX_DATA_SIZE) {
      // TODO: Map to WireException
      throw new Error("Asset size exceeds the maximum limit of 100MB")
    }

    return await this.assetsApiClient.uploadAsset(
      asset,
      assetUploadData
    )
  }
}
