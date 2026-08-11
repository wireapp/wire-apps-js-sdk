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

import {HttpClient} from '../core/HttpClient.js'
import {Encoder} from 'bazinga64'
import type {MlsKeyPackagesRequest} from './request/MlsKeyPackagesRequest.js'
import {singleton} from 'tsyringe'
import type {MlsPublicKeysResponse} from './response/MlsPublicKeysResponse.js'
import type {ClaimedKeyPackageList} from './response/ClaimedKeyPackageList.js'
import {AppProperties} from '../service/AppProperties.js'

@singleton()
export class MlsApiClient {
  constructor(
    private httpClient: HttpClient,
    private appProperties: AppProperties
  ) {}

  private readonly HEADER_MLS_CONTENT_TYPE = 'message/mls'
  private readonly basePath = 'mls'
  private readonly commitBundlesPath = this.basePath + '/commit-bundles'
  private readonly sendMessagePath = this.basePath + '/messages'
  private readonly uploadMlsKeyPackagesPath = this.basePath + '/key-packages/self/'
  private readonly claimKeyPackagesPath = this.basePath + '/key-packages/claim'
  private readonly getPublicKeysPath = this.basePath + '/public-keys'
  private readonly CIPHERSUITE_QUERY_PARAM = 'ciphersuite'

  async uploadCommitBundle(commitBundle: Uint8Array): Promise<void> {
    await this.httpClient.postRequest<void>(this.commitBundlesPath, commitBundle, {
      headerContentType: this.HEADER_MLS_CONTENT_TYPE
    })
  }

  async sendMessage(message: Uint8Array): Promise<void> {
    await this.httpClient.postRequest<void>(this.sendMessagePath, message, {
      headerContentType: this.HEADER_MLS_CONTENT_TYPE
    })
  }

  async uploadMlsKeyPackages(mlsKeyPackages: Uint8Array[]): Promise<void> {
    const path = `${this.uploadMlsKeyPackagesPath}${this.appProperties.getDeviceId()}`

    const requestPayload: MlsKeyPackagesRequest = {
      key_packages: mlsKeyPackages.map((keyPackage) => {
        return Encoder.toBase64(keyPackage).asString
      })
    }

    await this.httpClient.postRequest<void>(path, requestPayload)
  }

  async getPublicKeys(): Promise<MlsPublicKeysResponse> {
    return await this.httpClient.getRequest<MlsPublicKeysResponse>(this.getPublicKeysPath)
  }

  async claimKeyPackages(userId: string, userDomain: string, ciphersuite: string): Promise<ClaimedKeyPackageList> {
    const path = `${this.claimKeyPackagesPath}/${userDomain}/${userId}?${this.CIPHERSUITE_QUERY_PARAM}=${ciphersuite}`
    return await this.httpClient.postRequest<ClaimedKeyPackageList>(path)
  }
}
