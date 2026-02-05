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
import {singleton} from "tsyringe";
import type {ConversationIdsPaginationConfig} from "./model/ConversationIdsPaginationConfig.js";
import type {ConversationIdsResponse} from "./response/ConversationIdsResponse.js";
import type {ConversationIdsRequest} from "./request/ConversationIdsRequest.js";
import type {ConversationsResponse} from "./response/ConversationsResponse.js";

@singleton()
export class ConversationsApiClient {
  constructor(private httpClient: HttpClient) {
  }

  private readonly basePath = "conversations";
  private readonly HEADER_MLS_ACCEPT = "message/mls"
  private readonly CONVERSATION_LIST_IDS_PAGING_SIZE = 100
  private readonly FETCH_CONVERSATIONS_START_INDEX = 0
  private readonly FETCH_CONVERSATIONS_END_INDEX = 1000
  private readonly FETCH_CONVERSATIONS_INCREASE_INDEX = 1000

  async getConversation(conversationQualifiedId: QualifiedId): Promise<ConversationResponse> {
    return await this.httpClient.getRequest<ConversationResponse>(
      `${this.basePath}/${conversationQualifiedId.domain}/${conversationQualifiedId.id}`
    )
  }

  async getConversationGroupInfo(conversationQualifiedId: QualifiedId): Promise<Uint8Array> {
    return await this.httpClient.getRequest<Uint8Array>(
      `${this.basePath}/${conversationQualifiedId.domain}/${conversationQualifiedId.id}/groupinfo`,
      { headerAccept: this.HEADER_MLS_ACCEPT }
    )
  }

  async getConversationIds(): Promise<QualifiedId[]> {
    const conversationIds: QualifiedId[] = []
    let paginationConfig: ConversationIdsPaginationConfig = {
      paging_state: null,
      size: this.CONVERSATION_LIST_IDS_PAGING_SIZE
    }

    let hasMorePages: boolean = false
    do {
      const conversationIdsResponse = await this.httpClient.postRequest<ConversationIdsResponse>(
        `${this.basePath}/list-ids`,
        paginationConfig
      )

      hasMorePages = conversationIdsResponse.has_more
      paginationConfig = {
        ...paginationConfig,
        paging_state: conversationIdsResponse.paging_state
      }
      conversationIds.push(...conversationIdsResponse.qualified_conversations)
    } while (hasMorePages)

    return conversationIds
  }

  async getConversationsById(conversationIds: QualifiedId[]): Promise<ConversationResponse[]> {
    const conversations: ConversationResponse[] = []

    if (conversationIds.length === 0) {
      // TODO: Map to WireException
      throw new Error("List of conversations to fetch is empty")
    }

    let startIndex = this.FETCH_CONVERSATIONS_START_INDEX
    let endIndex = this.FETCH_CONVERSATIONS_END_INDEX

    do {
      if (endIndex > conversationIds.length) {
        endIndex = conversationIds.length
      }

      const conversationIdsRequest: ConversationIdsRequest = {
        qualified_ids: conversationIds.slice(startIndex, endIndex)
      }

      const conversationListResponse = await this.httpClient.postRequest<ConversationsResponse>(
        `${this.basePath}/list`,
        conversationIdsRequest
      )

      conversations.push(...conversationListResponse.found)
      startIndex += this.FETCH_CONVERSATIONS_INCREASE_INDEX
      endIndex += this.FETCH_CONVERSATIONS_INCREASE_INDEX
    } while (endIndex < conversationIds.length + this.FETCH_CONVERSATIONS_INCREASE_INDEX)

    return conversations
  }
}
