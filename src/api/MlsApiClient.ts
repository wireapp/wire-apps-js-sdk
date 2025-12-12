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

import {HttpClient} from "../core/HttpClient.js";
import {Encoder} from "bazinga64";
import type {MlsKeyPackagesRequest} from "./request/MlsKeyPackagesRequest.js";
import { singleton } from "tsyringe";

@singleton()
export class MlsApiClient {
  constructor(private httpClient: HttpClient) {
  }

  private readonly HEADER_MLS_CONTENT_TYPE = "message/mls"
  private readonly basePath = "mls"
  private readonly commitBundlesPath = this.basePath + "/commit-bundles"
  private readonly sendMessagePath = this.basePath + "/messages"
  private readonly uploadMlsKeyPackagesPath = this.basePath + "/key-packages/self/"

  async uploadCommitBundle(commitBundle: Uint8Array): Promise<void> {
    await this.httpClient.postRequest<void>(
      this.commitBundlesPath, commitBundle, this.HEADER_MLS_CONTENT_TYPE
    )
  }

  async sendMessage(message: Uint8Array): Promise<void> {
    await this.httpClient.postRequest<void>(
      this.sendMessagePath, message, this.HEADER_MLS_CONTENT_TYPE
    )
  }

  async uploadMlsKeyPackages(mlsKeyPackages: Uint8Array[]): Promise<void> {
    const path = `${this.uploadMlsKeyPackagesPath}${this.httpClient.getCachedDeviceId()}`

    const requestPayload: MlsKeyPackagesRequest = {
      key_packages: mlsKeyPackages.map((keyPackage) => {
        return Encoder.toBase64(keyPackage).asString
      })
    }

    await this.httpClient.postRequest<void>(path, requestPayload)
  }
}
