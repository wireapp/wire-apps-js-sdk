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
import type {UserResponse} from "./model/UserResponse.js";
import {singleton} from "tsyringe";
import type {UserClientResponse} from "./model/UserClientResponse.js";
import type {QualifiedId} from "../model/QualifiedId.js";

@singleton()
export class UsersApiClient {
  constructor(private httpClient: HttpClient) {
  }

  private readonly basePath = "users";

  async getUser(userId: string, userDomain: string): Promise<UserResponse> {
    const path = `${this.basePath}/${userDomain}/${userId}`
    return await this.httpClient.getRequest<UserResponse>(path)
  }

  async getClientsByUserId(userId: QualifiedId): Promise<Map<QualifiedId, UserClientResponse[]>> {
    const path = `${this.basePath}/${userId.domain}/${userId.id}/clients`;
    const userClientResponses = await this.httpClient.getRequest<UserClientResponse[]>(path);

    // Map<QualifiedId, List<UserClientResponse>>
    return new Map([[userId, userClientResponses]]);
  }

  async getClientsByUserIds(userIds: QualifiedId[]): Promise<Map<QualifiedId, UserClientResponse[]>> {
    const path = `${this.basePath}/list-clients`;
    const response = await this.httpClient
      .postRequest<Record<string, Record<string, UserClientResponse[]>>>(path, userIds);

    const result = new Map<QualifiedId, UserClientResponse[]>();

    for (const domain of Object.keys(response)) {
      const usersInDomain = response[domain];
      if (!usersInDomain) continue;

      for (const userId of Object.keys(usersInDomain)) {
        const clients = usersInDomain[userId];
        if (!clients) continue;

        const qualifiedId: QualifiedId = {id: userId, domain};
        result.set(qualifiedId, clients);
      }
    }

    // Map<QualifiedId, List<UserClientResponse>>
    return result;
  }

}
