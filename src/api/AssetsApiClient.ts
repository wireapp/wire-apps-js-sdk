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

import { HttpClient } from "../core/HttpClient.js";
import { singleton } from "tsyringe";
import type { AssetUploadData } from "./model/asset/AssetUploadData.js";
import type { AssetUploadResponse } from "./model/asset/AssetUploadResponse.js";
import { randomUUID } from "crypto";
import { concatToBuffer } from "../utils/BufferUtils.js";

@singleton()
export class AssetsApiClient {
  constructor(private httpClient: HttpClient) {
  }

  private readonly PATH_PUBLIC_ASSETS_V3 = "assets/v3";
  private readonly PATH_PUBLIC_ASSETS_V4 = "assets/v4";

  async downloadAsset(
    assetId: string,
    assetDomain: string,
    assetToken?: string
  ): Promise<Uint8Array> {
    const path = `${this.PATH_PUBLIC_ASSETS_V4}/${assetDomain}/${assetId}`
    const headerAssetToken: Record<string, string> = assetToken ? {"Asset-Token": assetToken} : {}

    return await this.httpClient.getRequest<Uint8Array>(
      path,
      {
        includeApiVersion: false
      },
      headerAssetToken,
    )
  }

  async uploadAsset(
    encryptedFile: Uint8Array,
    assetUploadData: AssetUploadData
  ): Promise<AssetUploadResponse> {
    const boundary = `Frontier${randomUUID()}`

    const metadata = JSON.stringify(assetUploadData)

    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json;charset=utf-8\r\n' +
      `Content-length: ${metadata.length}\r\n` +
      '\r\n' +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      'Content-Type: application/octet-stream\r\n' +
      `Content-length: ${encryptedFile.length}\r\n` +
      '\r\n';

    const footer = `\r\n--${boundary}--\r\n`;

    return await this.httpClient.postRequest(
      this.PATH_PUBLIC_ASSETS_V3,
      concatToBuffer(body, encryptedFile, footer),
      {
        headerContentType: `multipart/mixed; boundary=${boundary}`,
        includeApiVersion: false
      },
    )
  }
}
