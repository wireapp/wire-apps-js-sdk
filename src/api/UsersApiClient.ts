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
import type {UserResponse} from './model/UserResponse.js'
import {singleton} from 'tsyringe'
import type {UserClientResponse} from './model/UserClientResponse.js'
import {QualifiedId} from '../model/QualifiedId.js'
import type {ListUsersResponse} from './response/ListUsersResponse.js'
import {LoggerFactory} from '../utils/logger/LoggerFactory.js'

@singleton()
export class UsersApiClient {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  constructor(private httpClient: HttpClient) {}

  private readonly basePathUsers = 'users'
  private readonly basePathListUsers = 'list-users'

  async getUser(userId: string, userDomain: string): Promise<UserResponse> {
    const path = `${this.basePathUsers}/${userDomain}/${userId}`
    return await this.httpClient.getRequest<UserResponse>(path)
  }

  async getClientsByUserIds(userIds: QualifiedId[]): Promise<Map<string, UserClientResponse[]>> {
    const path = `${this.basePathUsers}/list-clients`
    const response = await this.httpClient.postRequest<{
      qualified_user_map: Record<string, Record<string, UserClientResponse[]>>
    }>(path, {qualified_users: userIds})

    const result = new Map<string, UserClientResponse[]>()

    for (const domain of Object.keys(response.qualified_user_map)) {
      const usersInDomain = response.qualified_user_map[domain]
      if (!usersInDomain) continue

      for (const userId of Object.keys(usersInDomain)) {
        const clients = usersInDomain[userId]
        if (!clients) continue

        const key = QualifiedId.toKey(new QualifiedId(userId, domain))
        result.set(key, clients)
      }
    }

    return result
  }

  // Note that this method is using {$basePathListUsers} as the base path
  async listUsers(userIds: QualifiedId[]): Promise<ListUsersResponse> {
    const path = `${this.basePathListUsers}`
    const response = await this.httpClient.postRequest<ListUsersResponse>(path, {qualified_ids: userIds})
    this.logger.debug(`Baris - TEMPORARY listUsers response: ${JSON.stringify(response)}`)
    return response
  }
}
