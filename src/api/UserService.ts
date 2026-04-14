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
import type {QualifiedId} from "../model/QualifiedId.js";
import type {UserResponse} from "./model/UserResponse.js";

@singleton()
export class UserService {
  constructor(
    private usersApiClient: UsersApiClient) {
  }

  async getUser(userQualifiedId: QualifiedId): Promise<UserResponse> {
    return await this.usersApiClient.getUser(userQualifiedId.id, userQualifiedId.domain);
  }

  async getUserName(userQualifiedId: QualifiedId): Promise<string> {
    return await this.getUser(userQualifiedId).then(user => user.name);
  }

}
