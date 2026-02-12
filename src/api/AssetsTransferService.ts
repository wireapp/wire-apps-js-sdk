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
import type { RemoteData } from "../model/WireMessage.js";
import { AESUtils } from "../utils/AESUtils.js";
import { HashUtils } from "../utils/HashUtils.js";
import type { AssetUploadData } from "./model/asset/AssetUploadData.js";
import { AssetRetention } from "./model/asset/AssetRetention.js";

@singleton()
export class AssetsTransferService {
  constructor(private assetsApiClient: AssetsApiClient) {
  }

  private readonly MAX_DATA_SIZE = 100 * 1024 * 1024

  async downloadAsset(assetRemoteData: RemoteData): Promise<Uint8Array> {
    const encryptedAsset: Uint8Array = await this.assetsApiClient.downloadAsset(
      assetRemoteData.assetId,
      assetRemoteData.assetDomain,
      assetRemoteData.assetToken
    )

    const calculatedSha256 = HashUtils.calculateSha256Hash(encryptedAsset)
    if (!HashUtils.isHashEqual(assetRemoteData.sha256, calculatedSha256)) {
      // TODO: Map to WireException
      throw new Error(`The sha256 doesn't match for asset with ID ${assetRemoteData.assetId}`)
    }

    return AESUtils.decryptData(encryptedAsset, assetRemoteData.otrKey)
  }

  async uploadAsset(
    asset: Uint8Array,
    retention?: AssetRetention
  ): Promise<RemoteData> {
    if (asset.length > this.MAX_DATA_SIZE) {
      // TODO: Map to WireException
      throw new Error("Asset size exceeds the maximum limit of 100MB")
    }

    const encryptionKey = AESUtils.generateRandomAES256Key()
    const encryptedFile = AESUtils.encryptData(asset, encryptionKey)
    const assetUploadData: AssetUploadData = {
      retention: retention ?? AssetRetention.ETERNAL_INFREQUENT_ACCESS,
      public: false
    }
    const assetSHA256Hash = HashUtils.calculateSha256Hash(encryptedFile)

    const assetUploadResponse = await this.assetsApiClient.uploadAsset(
      encryptedFile,
      assetUploadData
    )

    return {
      otrKey: encryptionKey,
      sha256: assetSHA256Hash,
      assetId: assetUploadResponse.key,
      assetDomain: assetUploadResponse.domain,
      assetToken: assetUploadResponse.token ?? null,
    }
  }
}
