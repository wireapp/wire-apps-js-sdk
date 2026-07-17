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
import {inject, singleton} from "tsyringe";
import type {ConversationIdsPaginationConfig} from "./model/ConversationIdsPaginationConfig.js";
import type {ConversationIdsResponse} from "./response/ConversationIdsResponse.js";
import type {ConversationIdsRequest} from "./request/ConversationIdsRequest.js";
import type {ConversationsResponse} from "./response/ConversationsResponse.js";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import {WIRE_USER_DOMAIN, WIRE_USER_ID} from "../utils/DependencyInjectionTokens.js";
import {obfuscateId} from "../utils/ObfuscateUtil.js";
import type {ConversationRole} from "../model/conversation/ConversationRole.js";
import type {CreateConversationRequest} from "./request/CreateConversationRequest.js";

@singleton()
export class ConversationsApiClient {
  constructor(
    @inject(WIRE_USER_ID) private wireUserId: string,
    @inject(WIRE_USER_DOMAIN) private wireUserDomain: string,
    private httpClient: HttpClient) {
  }

  private logger = LoggerFactory.getLogger(this.constructor.name)

  private readonly basePath = "conversations";
  private readonly HEADER_MLS_ACCEPT = "message/mls"
  private readonly CONVERSATION_LIST_IDS_PAGING_SIZE = 100

  //TODO: Baris: In all ApiClient classes, we should use "fetch" word instead of "get" to be consistent in terms of naming.
  // Note: We are following the common naming convention within this projects which is "fetch" for API calls and "get" for local data retrieval.
  // I will change the method names in all ApiClient classes in a separate PR. The methods in service layer are alredy using "fetch" naming convention.
  // But within ApiClient class, we missed this naming convention.

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

  async getAllConversationIds(): Promise<QualifiedId[]> {
    this.logger.info(`Getting all Conversation Ids`)
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

    this.logger.info(`Returning ${conversationIds.length} conversation Ids`)

    return conversationIds
  }

  async getConversationsById(conversationIds: QualifiedId[]): Promise<ConversationResponse[]> {
    this.logger.info(`Getting ${conversationIds.length} conversations by Id`)
    if (conversationIds.length === 0) {
      return []
    }

    const conversationIdsRequest: ConversationIdsRequest = {
      qualified_ids: conversationIds
    }

    const conversationListResponse = await this.httpClient.postRequest<ConversationsResponse>(
      `${this.basePath}/list`,
      conversationIdsRequest
    )

    this.logger.info(`Returning ${conversationListResponse.found.length} found conversations`)

    return conversationListResponse.found
  }

  async updateConversationMemberRole(
    conversationId: QualifiedId,
    userId: QualifiedId,
    newRole: ConversationRole
  ): Promise<void> {
    this.logger.debug(`Updating conversation member role. conversationId: ${obfuscateId(conversationId.id)}, userId: ${obfuscateId(userId.id)}, newRole: ${newRole}`)

    const path = `${this.basePath}/${conversationId.domain}/${conversationId.id}/members/${userId.domain}/${userId.id}`
    await this.httpClient.putRequest(path, {conversation_role: newRole})

    this.logger.debug(`Updated conversation member role. conversationId: ${obfuscateId(conversationId.id)}, userId: ${obfuscateId(userId.id)}, newRole: ${newRole}`)
  }

  // This method is used to create both GROUP and CHANNEL type conversations
  async createGroupConversation(createConversationRequest: CreateConversationRequest): Promise<ConversationResponse> {
    this.logger.info(`Creating group conversation with name: ${createConversationRequest.name}`)
    return await this.httpClient.postRequest<ConversationResponse>(
      this.basePath,
      createConversationRequest
    )
  }

  async leaveConversation(conversationQualifiedId: QualifiedId): Promise<void> {
    this.logger.debug(`Leaving the conversation. conversationId: ${obfuscateId(conversationQualifiedId.id)}`)

    const path = `${this.basePath}/${conversationQualifiedId.domain}/${conversationQualifiedId.id}/members/${this.wireUserDomain}/${this.wireUserId}`
    await this.httpClient.deleteRequest(path)

    this.logger.info(`Left the conversation. conversationId: ${obfuscateId(conversationQualifiedId.id)}`)
  }
}
