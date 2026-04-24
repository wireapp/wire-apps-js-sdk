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
import type {QualifiedId} from "../model/QualifiedId.js";
import {singleton} from "tsyringe";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import {obfuscateId} from "../utils/ObfuscateUtil.js";
import type {TeamId} from "../model/TeamId.js";

@singleton()
export class TeamsApiClient {
  constructor(
    private httpClient: HttpClient) {
  }

  private logger = LoggerFactory.getLogger(this.constructor.name)
  private readonly basePath = "teams";

  async deleteConversation(teamId: TeamId, conversationId: QualifiedId): Promise<void> {
    this.logger.info(`Conversation will be deleted in the backend. teamId: ${teamId}, conversationId: ${obfuscateId(conversationId.id)}`)

    const path = `${this.basePath}/${teamId.value}/conversations/${conversationId.id}`
    await this.httpClient.deleteRequest(path)

    this.logger.info(`Conversation is deleted in the backend. teamId: ${teamId}, conversationId: ${obfuscateId(conversationId.id)}`)
  }
}
