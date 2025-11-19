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

import { Service } from "typedi";
import { HttpClient } from "../core/HttpClient.js";
import { encodeBase64 } from "../utils/Base64Util.js";
import type { MlsKeyPackagesRequest } from "./request/MlsKeyPackagesRequest.js";

@Service()
export class MlsService {
  constructor(private httpClient: HttpClient) {}

  async uploadCommitBundle(commitBundle: Uint8Array): Promise<void> {
    await this.httpClient.postRequest<void>(
      "mls/commit-bundles",
      commitBundle,
      HttpClient.HEADER_MLS_CONTENT_TYPE
    )
  }

  async sendMessage(message: Uint8Array): Promise<void> {
    await this.httpClient.postRequest<void>(
      "mls/messages",
      message,
      HttpClient.HEADER_MLS_CONTENT_TYPE
    )
  }

  async uploadMlsKeyPackages(mlsKeyPackages: Uint8Array[]): Promise<void> {
    const mlsKeyPackagesRequest: MlsKeyPackagesRequest = {
      key_packages: mlsKeyPackages.map((keyPackage) => {
        return encodeBase64(keyPackage)
      })
    }
    await this.httpClient.postRequest<void>(
      `mls/key-packages/self/${this.httpClient.getCachedDeviceId()}`,
      mlsKeyPackagesRequest
    )
  }
}
