/*
 * Wire
 * Copyright (C) 2026 Wire Swiss GmbH
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

import {singleton} from "tsyringe";
import {UsersApiClient} from "./UsersApiClient.js";
import {QualifiedId} from "../model/QualifiedId.js";
import type {UserResponse} from "./model/UserResponse.js";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import {CryptoClientId} from "../model/CryptoClientId.js";

@singleton()
export class UserService {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  constructor(
    private usersApiClient: UsersApiClient) {
  }

  async getUser(userQualifiedId: QualifiedId): Promise<UserResponse> {
    return await this.usersApiClient.getUser(userQualifiedId.id, userQualifiedId.domain);
  }

  async getUsersClientIds(userIds: QualifiedId[]): Promise<Map<string, CryptoClientId[]>> {
    this.logger.info(`Retrieving clients for ${userIds.length} users.`);
    if (userIds.length === 0) return new Map();

    const usersToClients = await this.usersApiClient.getClientsByUserIds(userIds);

    return new Map(
      userIds.flatMap(qualifiedUserId => {
        const key = QualifiedId.toKey(qualifiedUserId);
        const userClientResponses = usersToClients.get(key);

        if (!userClientResponses?.length) {
          this.logger.warn(`User has no clients returned from API. userId: ${qualifiedUserId}`);
          return [];
        }

        const clientIds = userClientResponses.map(({id}) =>
          CryptoClientId.create(qualifiedUserId.id, id, qualifiedUserId.domain)
        );

        return [[key, clientIds]] as const;
      })
    );
  }

}
