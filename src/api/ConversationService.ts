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

import { Service } from "typedi";
import { HttpClient } from "../core/HttpClient.js";
import type { QualifiedId } from "../model/QualifiedId.js";
import type { ConversationResponse } from "./response/ConversationResponse.js";
import { ConversationRepository } from "../db/ConversationRepository.js";
import { ConversationMemberRepository } from "../db/ConversationMemberRepository.js";
import { ConversationType } from "../model/conversation/ConversationType.js";
import type { ConversationEntity } from "../db/model/ConversationEntity.js";
import type { ConversationMember } from "../model/conversation/ConversationMember.js";
import type { UserResponse } from "./model/UserResponse.js";
import { ConversationTypeMapper } from "../mappers/conversation/ConversationTypeMapper.js";

@Service()
export class ConversationService {
  constructor(
    private httpClient: HttpClient,
    private conversationRepository: ConversationRepository,
    private conversationMemberRepository: ConversationMemberRepository,
  ) {}

  async saveConversationWithMembers(
    conversationId: QualifiedId,
    conversation: ConversationResponse
  ): Promise<{conversation: ConversationEntity, members: ConversationMember[]}> {
    let conversationName: string
    if (conversation.type === ConversationType.ONE_TO_ONE && conversation.members.others.length > 0) {
      const firstUserId = conversation.members.others[0]!
      const getUserPath = `users/${firstUserId.qualified_id.domain}/${firstUserId.qualified_id.id}`
      const user = await this.httpClient.getRequest<UserResponse>(getUserPath)

      conversationName = user.name
    } else {
      conversationName = conversation.name ?? ""
    }
    
    const conversationEntity: ConversationEntity = {
      id: conversationId.id,
      domain: conversationId.domain,
      name: conversationName,
      team_id: conversation.team,
      mls_group_id: conversation.group_id,
      creation_date: null,
      type: ConversationTypeMapper.toModel(conversation.type)
    }
            
    this.conversationRepository.save(conversationEntity)

    const members = conversation.members.others.map((member) => {
      return {
        userId: member.qualified_id,
        role: member.conversation_role
      }
    })

    members.forEach((member) => {
      this.conversationMemberRepository.save({
        user_id: member.userId.id,
        user_domain: member.userId.domain,
        conversation_id: conversationId.id,
        conversation_domain: conversationId.domain,
        role: member.role,
        creation_date: null
      })
    })

    return {
      conversation: conversationEntity,
      members: members 
    }
  }

  async getConversationById(conversationId: QualifiedId): Promise<ConversationEntity> {
    const conversationEntity = this.conversationRepository.findByIdAndDomain(conversationId.id, conversationId.domain)

    if (conversationEntity) {
      return conversationEntity
    } else {
      const conversationResponse = await this.fetchConversationById(conversationId)
      const { conversation } = await this.saveConversationWithMembers(
        conversationId,
        conversationResponse
      )

      return conversation
    }
  }

  async fetchConversationById(conversationId: QualifiedId): Promise<ConversationResponse> {
    return await this.httpClient.getRequest<ConversationResponse>(
      `conversations/${conversationId.domain}/${conversationId.id}`
    )
  }

  async getConversationGroupId(conversationId: QualifiedId): Promise<string> {
    const conversation = await this.getConversationById(conversationId)

    return conversation.mls_group_id
  }
}
