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
import type {QualifiedId} from "../model/QualifiedId.js";
import { singleton } from "tsyringe";

@singleton()
export class UsersApiClient {
  constructor(private httpClient: HttpClient) {
  }

  private readonly basePath = "users";

  async getUserName(userQualifiedId: QualifiedId): Promise<string> {
    const user = await this.getUser(userQualifiedId.domain, userQualifiedId.id)
    return user.name
  }

  private async getUser(userDomain: string, userId: string) {
    const path = `${this.basePath}/${userDomain}/${userId}`
    return await this.httpClient.getRequest<UserResponse>(path)
  }
}
