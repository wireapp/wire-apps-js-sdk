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
import type {RegisterClientResponse} from "./response/RegisterClientResponse.js";
import {RegisterClientRequest} from "./request/RegisterClientRequest.js";
import type {MlsPublicKeys} from "../model/MlsPublicKeys.js";
import type {ClientUpdateRequest} from "./request/ClientUpdateRequest.js";
import {mapToPreKeyRequest} from "../mappers/PreKeyMapper.js";
import type {PreKeyCrypto} from "../model/PreKeyCrypto.js";
import {singleton} from "tsyringe";

@singleton()
export class ClientsApiClient {
  constructor(private httpClient: HttpClient) {
  }

  private readonly basePath = "clients";

  async registerClient(
    proteusPreKeys: PreKeyCrypto[],
    proteusLastPreKey: PreKeyCrypto
  ): Promise<string> {

    const requestPayload = new RegisterClientRequest(
      mapToPreKeyRequest(proteusLastPreKey),
      proteusPreKeys.map((preKey) =>
        mapToPreKeyRequest(preKey)
      )
    )

    const response = await this.httpClient.postRequest<RegisterClientResponse>(
      this.basePath,
      requestPayload
    )

    // Register client is performed with an access_token having limited scope.
    // Clear the token to force a refresh with the full-scope token for next requests.
    this.httpClient.clearAuthorizationToken()

    this.httpClient.setDeviceId(response.id)
    return response.id
  }

  async updateClientWithMlsPublicKey(mlsPublicKeys: MlsPublicKeys): Promise<void> {
    const requestPayload: ClientUpdateRequest = {
      mls_public_keys: mlsPublicKeys,
    }

    await this.httpClient.putRequest<void>(
      `${this.basePath}/${this.httpClient.getCachedDeviceId()}`,
      requestPayload
    )
  }

}
