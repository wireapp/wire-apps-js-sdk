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

import {singleton} from 'tsyringe'
import {UsersApiClient} from './UsersApiClient.js'
import {SearchApiClient} from './SearchApiClient.js'
import {QualifiedId} from '../model/QualifiedId.js'
import type {UserResponse} from './model/UserResponse.js'
import {LoggerFactory} from '../utils/logger/LoggerFactory.js'
import {CryptoClientId} from '../model/CryptoClientId.js'
import {WireUser} from '../model/WireUser.js'
import {TeamId} from '../model/TeamId.js'
import type {ContactDocument} from './response/SearchContactsResponse.js'

@singleton()
export class UserService {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  constructor(
    private usersApiClient: UsersApiClient,
    private searchApiClient: SearchApiClient
  ) {}

  async getUser(userQualifiedId: QualifiedId): Promise<WireUser> {
    const response = await this.usersApiClient.getUser(userQualifiedId.id, userQualifiedId.domain)
    return this.mapUserResponseToWireUser(response)
  }

  async getUsers(userIds: QualifiedId[]): Promise<WireUser[]> {
    this.logger.info(`Fetching ${userIds.length} users by qualified IDs`)
    const response = await this.usersApiClient.listUsers(userIds)
    return response.found.map((user) => this.mapUserResponseToWireUser(user))
  }

  /**
   * Searches for users matching the given query on the specified domain.
   *
   * Fields not present in the search response (email) are set to undefined.
   *
   * @param query The search string to match against user names and handles.
   * @param domain The domain to restrict the search to.
   * @param numberOfResults The maximum number of results to return,
   * or undefined to use the backend default.
   * @returns A list of WireUser objects matching the query.
   */
  async searchUsers(query: string, domain: string, numberOfResults?: number): Promise<WireUser[]> {
    this.logger.info(`Searching users with query: ${query} on domain: ${domain}`)
    const response = await this.searchApiClient.searchUsers(query, domain, numberOfResults)
    return response.documents.map((doc) => this.mapContactDocumentToWireUser(doc))
  }

  private mapUserResponseToWireUser(userResponse: UserResponse): WireUser {
    return new WireUser(
      new QualifiedId(userResponse.qualified_id.id, userResponse.qualified_id.domain),
      userResponse.name,
      userResponse.deleted,
      userResponse.email,
      userResponse.handle,
      userResponse.team ? new TeamId(userResponse.team) : undefined,
      userResponse.type
    )
  }

  private mapContactDocumentToWireUser(doc: ContactDocument): WireUser {
    return new WireUser(
      new QualifiedId(doc.qualified_id.id, doc.qualified_id.domain),
      doc.name,
      false,
      undefined,
      doc.handle ?? undefined,
      doc.team ? new TeamId(doc.team) : undefined
    )
  }

  async getUsersClientIds(userIds: QualifiedId[]): Promise<Map<string, CryptoClientId[]>> {
    this.logger.info(`Retrieving clients for ${userIds.length} users.`)
    if (userIds.length === 0) return new Map()

    const usersToClients = await this.usersApiClient.getClientsByUserIds(userIds)

    return new Map(
      userIds.flatMap((qualifiedUserId) => {
        const key = QualifiedId.toKey(qualifiedUserId)
        const userClientResponses = usersToClients.get(key)

        if (!userClientResponses?.length) {
          this.logger.warn(`User has no clients returned from API. userId: ${qualifiedUserId}`)
          return []
        }

        const clientIds = userClientResponses.map(({id}) =>
          CryptoClientId.create(qualifiedUserId.id, id, qualifiedUserId.domain)
        )

        return [[key, clientIds]] as const
      })
    )
  }
}
