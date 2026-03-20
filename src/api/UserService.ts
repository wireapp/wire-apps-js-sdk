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
import type {QualifiedId} from "../model/QualifiedId.js";
import type {UserEntity} from "../db/model/UserEntity.js";
import {UserRepository} from "../db/UserRepository.js";
import {UsersApiClient} from "./UsersApiClient.js";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";


@singleton()
export class UserService {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  constructor(
    private readonly userRepository: UserRepository,
    private readonly usersApiClient: UsersApiClient
  ) {
  }

  // Returns the cached user profile for a single ID, or null if not yet cached.
  // Always reads from the local DB — never triggers an API call.
  // Call cacheUsers() first to ensure the profile is available.
  getUser(qualifiedId: QualifiedId): UserEntity | null {
    return this.userRepository.findByIdAndDomain(qualifiedId.id, qualifiedId.domain)
  }

  // Ensures user profiles for all given IDs are present in the local cache.
  //
  // Strategy:
  //   1. Filter to IDs not already in the DB — avoids redundant network requests.
  //   2. Bulk-fetch the missing profiles in a single POST /users/list call.
  //   3. Persist the results so subsequent reads are served entirely from the DB.
  //
  // IDs the backend could not resolve (failed / not_found) are silently skipped;
  // getUser() will return null for them, and callers surface that as a null name.
  async cacheUsers(qualifiedIds: QualifiedId[]): Promise<void> {
    const missing = qualifiedIds.filter(
      id => this.userRepository.findByIdAndDomain(id.id, id.domain) === null
    )

    if (missing.length === 0) {
      return
    }

    this.logger.info(`Fetching ${missing.length} uncached user profile(s) from remote.`)

    const response = await this.usersApiClient.listUsers(missing)

    if (response.failed.length > 0) {
      // Log only the count — the failed list can be arbitrarily large in federated environments
      // and logging every ID would bloat the output.
      this.logger.warn(`${response.failed.length} user profile(s) could not be fetched (federated backend unreachable).`)
    }

    const toSave: UserEntity[] = response.found.map(user => ({
      user_id: user.qualified_id.id,
      user_domain: user.qualified_id.domain,
      name: user.name,
      handle: user.handle ?? null
    }))

    this.userRepository.saveMany(toSave)
    this.logger.info(`Cached ${toSave.length} user profile(s).`)
  }
}
