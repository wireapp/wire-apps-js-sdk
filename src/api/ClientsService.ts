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
import { RegisterClientRequest } from "./request/RegisterClientRequest.js";
import type { RegisterClientResponse } from "./response/RegisterClientResponse.js";
import type { MlsPublicKeys } from "../model/MlsPublicKeys.js";
import type { ClientUpdateRequest } from "./request/ClientUpdateRequest.js";

@Service()
export class ClientsService {
  constructor(private httpClient: HttpClient) {}

  async registerClient(
    registerClientRequest: RegisterClientRequest
  ): Promise<RegisterClientResponse> {
    const response = await this.httpClient.postRequest<RegisterClientResponse>(
      "clients",
      registerClientRequest
    );

    this.httpClient.setDeviceId(response.id);

    return response;
  }

  async updateClientWithMlsPublicKey(
    mlsPublicKeys: MlsPublicKeys
  ): Promise<void> {
    const clientUpdateRequest: ClientUpdateRequest = {
      mls_public_keys: mlsPublicKeys,
    };
    await this.httpClient.putRequest<void>(
      `clients/${this.httpClient.getCachedDeviceId()}`,
      clientUpdateRequest
    );
  }
}
