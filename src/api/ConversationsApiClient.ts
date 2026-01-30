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
import type {ConversationResponse} from "./response/ConversationResponse.js";
import type {QualifiedId} from "../model/QualifiedId.js";
import { singleton } from "tsyringe";

@singleton()
export class ConversationsApiClient {
  constructor(private httpClient: HttpClient) {
  }

  private readonly basePath = "conversations";
  private readonly HEADER_MLS_ACCEPT = "message/mls"
  private readonly HEADER_MLS_CONTENT_TYPE = "message/mls"

  async getConversation(conversationQualifiedId: QualifiedId): Promise<ConversationResponse> {
    return await this.httpClient.getRequest<ConversationResponse>(
      `${this.basePath}/${conversationQualifiedId.domain}/${conversationQualifiedId.id}`
    )
  }

  async getConversationGroupInfo(conversationQualifiedId: QualifiedId): Promise<Uint8Array> {
    return await this.httpClient.getRequest<Uint8Array>(
      `${this.basePath}/${conversationQualifiedId.domain}/${conversationQualifiedId.id}/groupinfo`,
      this.HEADER_MLS_CONTENT_TYPE,
      this.HEADER_MLS_ACCEPT
    )
  }
}
