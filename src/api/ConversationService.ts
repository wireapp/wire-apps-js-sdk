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

import type {QualifiedId} from "../model/QualifiedId.js";
import type {ConversationResponse} from "./response/ConversationResponse.js";
import {ConversationRepository} from "../db/ConversationRepository.js";
import {ConversationMemberRepository} from "../db/ConversationMemberRepository.js";
import {ConversationType} from "../model/conversation/ConversationType.js";
import type {ConversationEntity} from "../db/model/ConversationEntity.js";
import type {ConversationMember} from "../model/conversation/ConversationMember.js";
import {ConversationTypeMapper} from "../mappers/conversation/ConversationTypeMapper.js";
import type {ConversationMemberEntity} from "../db/model/ConversationMemberEntity.js";
import {obfuscateId} from "../utils/ObfuscateUtil.js";
import {UsersApiClient} from "./UsersApiClient.js";
import {ConversationsApiClient} from "./ConversationsApiClient.js";
import {singleton} from "tsyringe";
import type {ConversationMemberOtherResponse} from "./model/ConversationMemberOtherResponse.js";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import {CoreCryptoService} from "../core/CoreCryptoService.js";

@singleton()
export class ConversationService {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  constructor(
    private userApiClient: UsersApiClient,
    private conversationsApiClient: ConversationsApiClient,
    private conversationRepository: ConversationRepository,
    private conversationMemberRepository: ConversationMemberRepository,
    private coreCryptoService: CoreCryptoService,
  ) {
  }

  private async getConversationName(conversation: ConversationResponse) {
    if (conversation.type === ConversationType.ONE_TO_ONE && conversation.members.others.length > 0) {
      this.logger.info(
        "Fetching User from remote to populate Conversation name.",
        "conversationId:", obfuscateId(conversation.qualified_id.id)
      );

      const firstUser = conversation.members.others[0] as ConversationMemberOtherResponse
      return await this.userApiClient.getUserName(firstUser.qualified_id)
      // TODO: Introduce UserService class, move few lines there under getUserName() method
    } else {
      return conversation.name ?? ""
    }
  }

  async saveConversationWithMembers(
    conversationId: QualifiedId,
    conversation: ConversationResponse
  ): Promise<{ conversation: ConversationEntity, members: ConversationMember[] }> {
    const conversationName = await this.getConversationName(conversation)

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

    const members = [conversation.members.self, ...conversation.members.others].map((member) => ({
      userId: member.qualified_id,
      role: member.conversation_role
    }));

    const membersToSave: ConversationMemberEntity[] = members.map((member) => {
      return {
        user_id: member.userId.id,
        user_domain: member.userId.domain,
        conversation_id: conversationId.id,
        conversation_domain: conversationId.domain,
        role: member.role,
        creation_date: null
      }
    })

    this.conversationMemberRepository.saveMany(membersToSave)

    return {
      conversation: conversationEntity,
      members: members
    }
  }

  async getConversationById(conversationId: QualifiedId): Promise<ConversationEntity> {
    this.logger.info("Getting Conversation. conversationId:", obfuscateId(conversationId.id))
    const conversationEntity = this.conversationRepository.findByIdAndDomain(conversationId)

    if (conversationEntity) {
      this.logger.info("Returning Conversation from the Database.", "conversationId:", obfuscateId(conversationId.id))
      return conversationEntity
    } else {
      this.logger.info("Fetching Conversation from remote.", "conversationId:", obfuscateId(conversationId.id))
      const conversationResponse = await this.fetchConversationById(conversationId)
      const {conversation} = await this.saveConversationWithMembers(
        conversationId,
        conversationResponse
      )
      // TODO: If we're passing ConversationResponse object to different layer,
      //  why do we have Conversation class as well?
      //  We can re-consider this (and similar cases with domain classes) separately for simplification in the code base.

      return conversation
    }
  }

  //TODO: Baris: Imo, this method should be private.
  // We can call getConversationById() method from outside. That will call this method IF NEEDED.
  async fetchConversationById(conversationId: QualifiedId): Promise<ConversationResponse> {
    return await this.conversationsApiClient.getConversation(conversationId)
  }

  async getConversationMLSGroupId(conversationId: QualifiedId): Promise<string> {
    const conversation = await this.getConversationById(conversationId)

    return conversation.mls_group_id
  }

  async getConversationGroupInfo(conversationId: QualifiedId): Promise<Uint8Array> {
    return await this.conversationsApiClient.getConversationGroupInfo(conversationId)
  }

  getMembersByConversationId(conversationId: QualifiedId): ConversationMemberEntity[] {
    return this.conversationMemberRepository.getMembersByConversationId(
      conversationId.id,
      conversationId.domain
    )
  }

  async deleteAllConversationDataFromLocalStorages(conversationId: QualifiedId): Promise<void> {
    this.logger.info("Deleting all conversation data.", "conversationId:", obfuscateId(conversationId.id))
    const mlsGroupId = (await this.getConversationMLSGroupId(conversationId))

    if (await this.coreCryptoService.isConversationExists(mlsGroupId)) {
      await this.coreCryptoService.wipeConversation(mlsGroupId)
    }

    this.conversationRepository.deleteAllMembersInConversation(conversationId.id, conversationId.domain)
    this.conversationRepository.delete(conversationId.id, conversationId.domain)

    this.logger.info("Deleted all conversation data.", "conversationId:", obfuscateId(conversationId.id))
  }
}
