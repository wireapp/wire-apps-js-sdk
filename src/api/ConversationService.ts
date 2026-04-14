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
import type {ConversationMemberEntity} from "../db/model/ConversationMemberEntity.js";
import {obfuscateId} from "../utils/ObfuscateUtil.js";
import {ConversationsApiClient} from "./ConversationsApiClient.js";
import {inject, singleton} from "tsyringe";
import type {ConversationMemberOtherResponse} from "./model/ConversationMemberOtherResponse.js";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import {AppProperties} from "../service/AppProperties.js";
import {CryptoProtocol} from "../model/CryptoProtocol.js";
import {CoreCryptoService} from "../core/CoreCryptoService.js";
import {WIRE_USER_DOMAIN, WIRE_USER_ID} from "../utils/DependencyInjectionTokens.js";
import {ConversationRole} from "../model/conversation/ConversationRole.js";
import {TeamsApiClient} from "./TeamsApiClient.js";
import {TeamId} from "../model/TeamId.js";
import type {AddMembersToConversationResult} from "./model/AddMembersToConversationResult.js";

@singleton()
export class ConversationService {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  constructor(
    @inject(WIRE_USER_ID) private wireUserId: string,
    @inject(WIRE_USER_DOMAIN) private wireUserDomain: string,
    private teamsApiClient: TeamsApiClient,
    private conversationsApiClient: ConversationsApiClient,
    private conversationRepository: ConversationRepository,
    private conversationMemberRepository: ConversationMemberRepository,
    private appProperties: AppProperties,
    private coreCryptoService: CoreCryptoService
  ) {
  }

  private getConversationName(conversation: ConversationResponse) : string {
    if (conversation.type === ConversationType.ONE_TO_ONE && conversation.members.others.length > 0) {
      this.logger.info(
        "Fetching User from remote to populate Conversation name.",
        "conversationId:", obfuscateId(conversation.qualified_id.id)
      );

      const firstUser = (conversation.members.others[0] as ConversationMemberOtherResponse).qualified_id
      return `${firstUser.id}@${firstUser.domain}`
    } else {
      return conversation.name ?? ""
    }
  }

  // TODO: Baris: We can still have this method but we better have "saving conversation" and "saving members"
  //  as two separate methods that we call within this method just to have them together pactically.
  //  We can have "saving members" methods accepting different type of arrays. (This can be thought further.)
  async saveConversationWithMembers(
    conversationId: QualifiedId,
    conversation: ConversationResponse
  ): Promise<{ conversation: ConversationEntity, members: ConversationMember[] }> {
    const conversationName = this.getConversationName(conversation)

    const conversationEntity: ConversationEntity = {
      id: conversationId.id,
      domain: conversationId.domain,
      name: conversationName,
      team_id: conversation.team,
      mls_group_id: conversation.group_id,
      creation_date: null,
      type: conversation.type
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

  // TODO: Baris: Rename this to getOrFetchConversation to better reflect what it does.
  //  The name should indicate that it might fetch the conversation if it's not found locally.
  async getConversationById(conversationId: QualifiedId): Promise<ConversationEntity> {
    this.logger.info("Getting Conversation. conversationId:", obfuscateId(conversationId.id))
    const conversationEntity = this.conversationRepository.findByIdAndDomain(conversationId.id, conversationId.domain)

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

  async fetchConversationById(conversationId: QualifiedId): Promise<ConversationResponse> {
    return await this.conversationsApiClient.getConversation(conversationId)
  }

  async fetchEpoch(conversationId: QualifiedId): Promise<number> {
    const conversation = await this.fetchConversationById(conversationId)
    return conversation.epoch
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

  async leaveConversation(conversationId: QualifiedId) {
    this.logger.info("Leaving the conversation. conversationId:" + obfuscateId(conversationId.id))

    if (!await this.isGroupConversation(conversationId)) {
      this.logger.warn("You cannot leave a non-group conversation. conversationId:" + obfuscateId(conversationId.id))
      return // TODO: Baris: We should throw an exception here instead of just logging and returning.
    }

    if (!await this.isAppUserMemberOfConversation(conversationId)) {
      this.logger.warn("You cannot leave a conversation that you are not a member of. conversationId:" + obfuscateId(conversationId.id))
      return // TODO: Baris: We should throw an exception here instead of just logging and returning.
    }

    await this.conversationsApiClient.leaveConversation(conversationId)
    await this.deleteAllConversationDataFromLocalStorages(conversationId)

    this.logger.info("App user left the conversation. conversationId:" + obfuscateId(conversationId.id))
  }

  private async isGroupConversation(conversationId: QualifiedId): Promise<boolean> {
    const conversation = await this.getConversationById(conversationId)
    return conversation.type === ConversationType.GROUP
  }

  private async isAppUserMemberOfConversation(conversationId: QualifiedId): Promise<boolean> {
    const members = this.getMembersByConversationId(conversationId)
    return members.some(member => member.user_id === this.wireUserId && member.user_domain === this.wireUserDomain)
  }

  async deleteAllConversationDataFromLocalStorages(conversationId: QualifiedId): Promise<void> {
    this.logger.info("Deleting all conversation data.", "conversationId:", obfuscateId(conversationId.id))
    const conversationEntity = this.conversationRepository.findByIdAndDomain(conversationId.id, conversationId.domain);

    if (conversationEntity?.mls_group_id) {
      if (await this.coreCryptoService.conversationExists(conversationEntity.mls_group_id)) {
        await this.coreCryptoService.wipeConversation(conversationEntity.mls_group_id)
      }
    }

    this.conversationMemberRepository.deleteAllMembersInConversation(conversationId.id, conversationId.domain)
    this.conversationRepository.delete(conversationId.id, conversationId.domain)

    this.logger.info("Deleted all conversation data.", "conversationId:", obfuscateId(conversationId.id))
  }

  async addMembersToConversation(
    conversationId: QualifiedId,
    members: QualifiedId[]
  ): Promise<AddMembersToConversationResult> {
    if (members.length === 0) {
      throw new Error("List of members cannot be empty.") // TODO: Use custom exceptions (WireException.InvalidParameter)
    }

    const conversation = await this.getConversationById(conversationId)

    this.requireConversationIsGroupOrChannel(conversationId, conversation.type)
    this.requireAppIsAdminInConversation(conversationId)

    let result: AddMembersToConversationResult
    try {
      result = await this.coreCryptoService.addMemberToMlsConversation(
        conversation.mls_group_id,
        members
      )
    } catch (error) {
      throw new Error(`Unable to add members to MLS conversation: ${(error as Error).message}`) // TODO: Use custom exceptions
    }

    const membersToSave: ConversationMemberEntity[] = result.successUsers.map((userId) => ({
      user_id: userId.id,
      user_domain: userId.domain,
      conversation_id: conversationId.id,
      conversation_domain: conversationId.domain,
      role: ConversationRole.MEMBER,
      creation_date: null
    }))

    this.conversationMemberRepository.saveMany(membersToSave)

    this.logger.info(`${result.successUsers.length} member(s) successfully added to the conversation. ` +
      `conversationId: ${obfuscateId(conversationId.id)}`
    )

    return result
  }

  async updateConversationMemberRole(
    conversationId: QualifiedId,
    userId: QualifiedId,
    newRole: ConversationRole
  ): Promise<void> {
    this.logger.info(`Updating member in conversation. conversationId: ${obfuscateId(conversationId.id)},
      userId: ${obfuscateId(userId.id)}, newRole: ${newRole}`)

    const conversation = await this.getConversationById(conversationId)
    this.requireConversationIsGroupOrChannel(conversationId, conversation.type)
    this.requireAppIsAdminInConversation(conversationId)
    this.requireUserIsInConversation(conversationId, userId)

    await this.conversationsApiClient.updateConversationMemberRole(conversationId, userId, newRole)

    const memberToSave: ConversationMemberEntity = {
      user_id: userId.id,
      user_domain: userId.domain,
      conversation_id: conversationId.id,
      conversation_domain: conversationId.domain,
      role: newRole,
      creation_date: null
    }

    this.conversationMemberRepository.save(memberToSave)

    this.logger.info(`Updated member in conversation. conversationId: ${obfuscateId(conversationId.id)},
      userId: ${obfuscateId(userId.id)}, newRole: ${newRole}`)
  }

  async syncMemberUpdate(userId: QualifiedId, conversationId: QualifiedId, newRole: ConversationRole): Promise<void> {
    this.logger.info(`Syncing member in conversation. conversationId: ${obfuscateId(conversationId.id)},
      userId: ${obfuscateId(userId.id)}, newRole: ${newRole}`)

    if (this.conversationRepository.findByIdAndDomain(conversationId.id, conversationId.domain) == null) {
      this.logger.warn(`Conversation does not exist locally. Skipping updating member
        for conversationId: ${obfuscateId(conversationId.id)}, userId: ${obfuscateId(userId.id)}`)
      return
    }

    const memberEntity: ConversationMemberEntity = {
      user_id: userId.id,
      user_domain: userId.domain,
      conversation_id: conversationId.id,
      conversation_domain: conversationId.domain,
      role: newRole,
      creation_date: null
    }

    this.conversationMemberRepository.save(memberEntity)
    this.logger.info(`Synced member in conversation. conversationId: ${obfuscateId(conversationId.id)},
        userId: ${obfuscateId(userId.id)}, newRole: ${newRole}`)
  }

  async syncMembersAdded(members: ConversationMember[], conversationId: QualifiedId): Promise<void> {
    this.logger.info(`Adding members to conversation. conversationId: ${obfuscateId(conversationId.id)}, members length: ${members.length}`)

    // TODO: Baris: In such cases we should throw custom exceptions and handle them in the upper layers instead of just logging and skipping the events.
    //  For example for this scenario, the Router class should not call the callback method if we didn't add the members to the conversation
    if (this.conversationRepository.findByIdAndDomain(conversationId.id, conversationId.domain) == null) {
      this.logger.warn(`Conversation does not exist locally. Skipping MemberJoin event for conversationId: ${obfuscateId(conversationId.id)}`)
      return
    }

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
    this.logger.info(`Added members to conversation. conversationId: ${obfuscateId(conversationId.id)}, members length: ${members.length}`)
  }

  async syncMembersRemoved(userIds: QualifiedId[], conversationId: QualifiedId): Promise<void> {
    this.logger.info(`Removing members from conversation. conversationId: ${obfuscateId(conversationId.id)}, userIds length: ${userIds.length}`)

    if (this.conversationRepository.findByIdAndDomain(conversationId.id, conversationId.domain) == null) {
      this.logger.warn(`Conversation does not exist locally. Skipping MemberLeave event for conversationId: ${obfuscateId(conversationId.id)}`)
      return
    }

    if (this.containsAppUser(userIds)) {
      this.logger.info(`List of members to be removed contains the Wire user. Deleting all conversation data for conversationId: ${obfuscateId(conversationId.id)}`)
      await this.deleteAllConversationDataFromLocalStorages(conversationId)
    } else {
      this.conversationMemberRepository.deleteMany(userIds, conversationId.id, conversationId.domain)
    }
    this.logger.info(`Removed members from conversation. conversationId: ${obfuscateId(conversationId.id)}, userIds length: ${userIds.length}`)
  }

  private containsAppUser(userIds: QualifiedId[]): boolean {
    return userIds.some(user => user.id === this.wireUserId && user.domain === this.wireUserDomain)
  }


  async establishOrRejoinConversations(): Promise<void> {
    const shouldRejoinConversations = this.appProperties.getShouldRejoinConversations()
    if (!shouldRejoinConversations) {
      this.logger.info("Skipping re-joining conversations as its not needed.")
      return
    }

    const allConversationIds = await this.conversationsApiClient.getAllConversationIds()

    let startIndex = 0
    let endIndex = 1000
    const sliceSize = 1000

    do {
      if (endIndex > allConversationIds.length) {
        endIndex = allConversationIds.length
      }

      const conversationIdsSlice = allConversationIds.slice(startIndex, endIndex)
      const conversations = await this.conversationsApiClient.getConversationsById(conversationIdsSlice)

      const mlsConversations = conversations.filter(conversation =>
        conversation.protocol === CryptoProtocol.MLS
      )

      for (const conversation of mlsConversations) {
        await this.establishOrJoinMlsConversation(conversation)
      }

      startIndex += sliceSize
      endIndex += sliceSize
    } while (endIndex < allConversationIds.length + sliceSize)

    this.appProperties.setShouldRejoinConversations(false)
  }

  private async establishOrJoinMlsConversation(conversation: ConversationResponse): Promise<void> {
    if (await this.coreCryptoService.conversationExists(conversation.group_id)) {
      this.logger.info(`Conversation ${obfuscateId(conversation.qualified_id.id)} already exists, skipping it`)
      return
    }

    if (conversation.epoch != null && conversation.epoch !== 0) {
      const conversationGroupInfoBytes = await this.conversationsApiClient.getConversationGroupInfo(conversation.qualified_id)
      await this.coreCryptoService.joinMlsConversation(conversationGroupInfoBytes)
      await this.saveConversationWithMembers(conversation.qualified_id, conversation)
    } else if (conversation.type === ConversationType.SELF) {
      await this.coreCryptoService.establishMlsConversation([], conversation.group_id)
    }
  }

  async deleteConversation(conversationId: QualifiedId): Promise<void> {
    this.logger.info("Attempting to delete conversation. conversationId:", obfuscateId(conversationId.id))
    const conversation = await this.getConversationById(conversationId)

    if (!conversation.team_id) {
      throw new Error("Conversation teamId must not be null.")
    }
    this.requireConversationIsGroupOrChannel(conversationId, conversation.type)
    this.requireAppIsAdminInConversation(conversationId)

    await this.teamsApiClient.deleteConversation(new TeamId(conversation.team_id), conversationId)
    await this.deleteAllConversationDataFromLocalStorages(conversationId)

    this.logger.info(`Conversation is deleted. teamId: ${obfuscateId(conversation.team_id)}, conversationId: ${obfuscateId(conversationId.id)}`)
  }

  private requireConversationIsGroupOrChannel(conversationId: QualifiedId, conversationType: ConversationType): void {
    if (conversationType !== ConversationType.GROUP) {
      this.logger.warn(`Skipping operation, conversation is not a GROUP or CHANNEL. conversationId: ${obfuscateId(conversationId.id)}, conversationType: ${conversationType}`)
      throw new Error("Conversation type is not GROUP.") //TODO: Use custom exceptions
    }
  }

  private requireAppIsAdminInConversation(conversationId: QualifiedId): void {
    const members = this.getMembersByConversationId(conversationId)
    const isAppAdminInConversation = members.some(
      member =>
        member.user_id === this.wireUserId
        && member.user_domain === this.wireUserDomain
        && member.role === ConversationRole.ADMIN
    )

    if (!isAppAdminInConversation) {
      this.logger.warn(`App user is not an admin in the conversation. conversationId: ${obfuscateId(conversationId.id)}, appUserId: ${obfuscateId(this.wireUserId)}`)
      throw new Error("App user is not an admin in the conversation.") //TODO: Use custom exceptions
    }
  }

  private requireUserIsInConversation(conversationId: QualifiedId, userId: QualifiedId): void {
    const exists = this.conversationMemberRepository.exists(
      userId.id,
      userId.domain,
      conversationId.id,
      conversationId.domain)

    if (!exists) {
      this.logger.warn(`User is not in the conversation. conversationId: ${obfuscateId(conversationId.id)}, UserId: ${obfuscateId(userId.id)}`)
      throw new Error("User is not in the conversation.") //TODO: Use custom exceptions
    }
  }
}
