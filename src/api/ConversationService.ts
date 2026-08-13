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

import {QualifiedId} from '../model/QualifiedId.js'
import type {ConversationResponse} from './response/ConversationResponse.js'
import {ConversationRepository} from '../db/ConversationRepository.js'
import {ConversationMemberRepository} from '../db/ConversationMemberRepository.js'
import {ConversationType} from '../model/conversation/ConversationType.js'
import type {ConversationEntity} from '../db/model/ConversationEntity.js'
import type {ConversationMember} from '../model/conversation/ConversationMember.js'
import type {ConversationMemberEntity} from '../db/model/ConversationMemberEntity.js'
import {obfuscateId} from '../utils/ObfuscateUtil.js'
import {ConversationsApiClient} from './ConversationsApiClient.js'
import {singleton} from 'tsyringe'
import type {ConversationMemberOtherResponse} from './model/ConversationMemberOtherResponse.js'
import {LoggerFactory} from '../utils/logger/LoggerFactory.js'
import {AppProperties} from '../service/AppProperties.js'
import {CryptoProtocol} from '../model/CryptoProtocol.js'
import {CoreCryptoService} from '../core/CoreCryptoService.js'
import {ConversationRole} from '../model/conversation/ConversationRole.js'
import {TeamsApiClient} from './TeamsApiClient.js'
import {TeamId} from '../model/TeamId.js'
import type {AddMembersToConversationResult} from './model/AddMembersToConversationResult.js'
import type {RemoveMembersFromConversationResult} from './model/RemoveMembersFromConversationResult.js'
import type {Conversation} from '../model/conversation/Conversation.js'
import {ConversationMapper} from '../mappers/conversation/ConversationMapper.js'
import {ConversationMemberMapper} from '../mappers/conversation/ConversationMemberMapper.js'
import {UserService} from './UserService.js'
import {
  createChannelConversationRequest,
  type CreateConversationRequest,
  createGroupConversationRequest
} from './request/CreateConversationRequest.js'
import {GroupConversationType} from '../model/conversation/GroupConversationType.js'
import type {OneToOneConversationResponse} from './response/OneToOneConversationResponse.js'
import {OneToOneConversationsApiClient} from './OneToOneConversationsApiClient.js'
import {ForbiddenError, InvalidParameterError, UnknownError} from '../exception/WireException.js'

@singleton()
export class ConversationService {
  private logger = LoggerFactory.getLogger(this.constructor.name)
  private appQualifiedId?: QualifiedId

  constructor(
    private teamsApiClient: TeamsApiClient,
    private conversationsApiClient: ConversationsApiClient,
    private oneToOneConversationsApiClient: OneToOneConversationsApiClient,
    private conversationRepository: ConversationRepository,
    private conversationMemberRepository: ConversationMemberRepository,
    private appProperties: AppProperties,
    private coreCryptoService: CoreCryptoService,
    private userService: UserService
  ) {}

  private getApplicationQualifiedId(): QualifiedId {
    this.appQualifiedId ??= this.appProperties.getApplicationQualifiedId()
    return this.appQualifiedId
  }

  async createOneToOne(withUser: QualifiedId): Promise<QualifiedId> {
    // Return the conversation if it was already created
    const conversationRecordInDB = this.conversationRepository.findOneToOneByNameAndDomain(
      this.getOneToOneConversationNameByUserId(withUser),
      withUser.domain
    )

    if (conversationRecordInDB != null) {
      if (await this.coreCryptoService.conversationExists(conversationRecordInDB.mlsGroupId)) {
        this.logger.info(
          `OneToOne Conversation was already established. userId: ${withUser}, conversationId: ${conversationRecordInDB.id}`
        )
        return new QualifiedId(conversationRecordInDB.id, conversationRecordInDB.domain)
      } else {
        this.logger.warn(
          `(Unexpected case) OneToOne conversation exists in the local database but is missing from CoreCrypto. ` +
            `This indicates an inconsistent state. The SDK will recreate and re-establish the MLS conversation to recover. ` +
            `userId: ${withUser}, conversationId: ${conversationRecordInDB.id}`
        )
      }
    }

    // Create 1-1 conversation.
    const oneToOneConversationResponse: OneToOneConversationResponse =
      await this.oneToOneConversationsApiClient.getOneToOneConversation(withUser)
    const conversationResponse = oneToOneConversationResponse.conversation
    // Handle CoreCrypto and local database operations
    await this.coreCryptoService.establishMlsConversation(
      conversationResponse.group_id,
      oneToOneConversationResponse.public_keys
    )
    await this.addUsersInCoreCryptoAndSaveInLocalDB(conversationResponse, [withUser])

    return new QualifiedId(conversationResponse.qualified_id.id, conversationResponse.qualified_id.domain)
  }

  private getOneToOneConversationNameByUserId(userId: QualifiedId): string {
    return QualifiedId.toKey(userId)
  }

  async createGroup(name: string, usersToAdd: QualifiedId[]): Promise<QualifiedId> {
    return this.createGroupTypeConversation(name, usersToAdd, GroupConversationType.REGULAR_GROUP)
  }

  async createChannel(name: string, usersToAdd: QualifiedId[]): Promise<QualifiedId> {
    return this.createGroupTypeConversation(name, usersToAdd, GroupConversationType.CHANNEL)
  }

  private async createGroupTypeConversation(
    name: string,
    usersToAdd: QualifiedId[],
    groupConversationType: GroupConversationType
  ): Promise<QualifiedId> {
    const teamId = await this.getSelfTeamId()

    let apiRequest: CreateConversationRequest
    switch (groupConversationType) {
      case GroupConversationType.REGULAR_GROUP:
        apiRequest = createGroupConversationRequest(name, teamId)
        break
      case GroupConversationType.CHANNEL:
        apiRequest = createChannelConversationRequest(name, teamId)
        break
    }

    // Create group/channel conversation.
    const conversationResponse = await this.conversationsApiClient.createGroupConversation(apiRequest)
    // Handle CoreCrypto and local database operations
    await this.coreCryptoService.establishMlsConversation(conversationResponse.group_id)
    await this.addUsersInCoreCryptoAndSaveInLocalDB(conversationResponse, usersToAdd)

    return new QualifiedId(conversationResponse.qualified_id.id, conversationResponse.qualified_id.domain)
  }

  /**
   * 1. Add the users in CoreCrypto
   * 2. Save the conversation and its members (that are verified by CoreCrypto in the first step) in the local database
   *
   * This method is wrapping both operations since they are tightly connected to each other in an order
   * for any kind of conversation creation.
   */
  private async addUsersInCoreCryptoAndSaveInLocalDB(
    conversationResponse: ConversationResponse,
    usersToAdd: QualifiedId[]
  ) {
    const addMembersToConversationResult = await this.coreCryptoService.addClientsToMlsConversation(
      conversationResponse.group_id,
      usersToAdd
    )

    // Overrides conversationResponse 'members' with the actual users successfully claimed in CoreCrypto side
    const conversationResponseWithUpdatedMembers: ConversationResponse = {
      ...conversationResponse,
      members: {
        self: conversationResponse.members.self,
        others: addMembersToConversationResult.membersAdded.map((userId) => ({
          qualified_id: userId,
          conversation_role: ConversationRole.MEMBER
        }))
      }
    }

    await this.saveConversationWithMembers(
      conversationResponseWithUpdatedMembers.qualified_id,
      conversationResponseWithUpdatedMembers
    )
  }

  // TODO: Update this method (or remove completely) in order to use from the return of existing Self (WireUser) that will be done in WPB-27980
  private async getSelfTeamId(): Promise<TeamId> {
    const selfUser = await this.userService.getUser(this.getApplicationQualifiedId())
    if (!selfUser.teamId) {
      throw new InvalidParameterError('App user does not belong to a team.')
    }
    return selfUser.teamId
  }

  getAllConversations(): Conversation[] {
    return this.conversationRepository
      .getAll()
      .filter((conversation) => conversation.type !== ConversationType.SELF)
      .map((conversation) => ConversationMapper.fromEntity(conversation))
  }

  private getConversationName(conversation: ConversationResponse): string {
    if (conversation.type === ConversationType.ONE_TO_ONE && conversation.members.others.length > 0) {
      const firstUser = (conversation.members.others[0] as ConversationMemberOtherResponse).qualified_id
      return this.getOneToOneConversationNameByUserId(firstUser)
    } else {
      return conversation.name ?? ''
    }
  }

  // TODO: Baris: We can still have this method but we better have "saving conversation" and "saving members"
  //  as two separate methods that we call within this method just to have them together pactically.
  //  We can have "saving members" methods accepting different type of arrays. (This can be thought further.)
  async saveConversationWithMembers(
    conversationId: QualifiedId, //TODO: Remove this and use from ConversationResponse
    conversation: ConversationResponse
  ): Promise<{conversation: ConversationEntity; members: ConversationMember[]}> {
    const conversationName = await this.getConversationName(conversation)

    const conversationEntity: ConversationEntity = {
      id: conversationId.id,
      domain: conversationId.domain,
      name: conversationName,
      teamId: conversation.team,
      mlsGroupId: conversation.group_id,
      creationDate: null,
      type: conversation.type
    }

    this.conversationRepository.save(conversationEntity)

    const members = [conversation.members.self, ...conversation.members.others].map((member) => ({
      userId: member.qualified_id,
      role: member.conversation_role
    }))

    const membersToSave: ConversationMemberEntity[] = members.map((member) => {
      return {
        userId: member.userId.id,
        userDomain: member.userId.domain,
        conversationId: conversationId.id,
        conversationDomain: conversationId.domain,
        role: member.role,
        creationDate: null
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
    this.logger.info(`Getting Conversation. conversationId: ${conversationId}`)
    const conversationEntity = this.conversationRepository.findByIdAndDomain(conversationId.id, conversationId.domain)

    if (conversationEntity) {
      this.logger.info(`Returning Conversation from the Database. conversationId: ${conversationId}`)
      return conversationEntity
    } else {
      this.logger.info(`Fetching Conversation from remote. conversationId: ${conversationId}`)
      const conversationResponse = await this.fetchConversationById(conversationId)
      const {conversation} = await this.saveConversationWithMembers(conversationId, conversationResponse)
      // TODO: If we're passing ConversationResponse object to different layer,
      //  why do we have Conversation class as well?
      //  We can re-consider this (and similar cases with domain classes) separately for simplification in the code base.

      return conversation
    }
  }

  async fetchConversationById(conversationId: QualifiedId): Promise<ConversationResponse> {
    return await this.conversationsApiClient.getConversation(conversationId)
  }

  async fetchEpoch(conversationId: QualifiedId): Promise<number | null> {
    const conversation = await this.fetchConversationById(conversationId)
    return conversation.epoch
  }

  async getConversationMLSGroupId(conversationId: QualifiedId): Promise<string> {
    const conversation = await this.getConversationById(conversationId)

    return conversation.mlsGroupId
  }

  async getConversationGroupInfo(conversationId: QualifiedId): Promise<Uint8Array> {
    return await this.conversationsApiClient.getConversationGroupInfo(conversationId)
  }

  getMembersByConversationId(conversationId: QualifiedId): ConversationMember[] {
    return this.conversationMemberRepository
      .getMembersByConversationId(conversationId.id, conversationId.domain)
      .map(ConversationMemberMapper.fromEntity)
  }

  async leaveConversation(conversationId: QualifiedId) {
    this.logger.info(`Leaving the conversation. conversationId: ${conversationId}`)

    if (!(await this.isGroupConversation(conversationId))) {
      this.logger.warn(`You cannot leave a non-group conversation. conversationId: ${conversationId}`)
      return // TODO: Baris: We should throw an exception here instead of just logging and returning.
    }

    if (!(await this.isAppUserMemberOfConversation(conversationId))) {
      this.logger.warn(
        `You cannot leave a conversation that you are not a member of. conversationId: ${conversationId}`
      )
      return // TODO: Baris: We should throw an exception here instead of just logging and returning.
    }

    await this.conversationsApiClient.leaveConversation(conversationId, this.getApplicationQualifiedId())
    await this.deleteAllConversationDataFromLocalStorages(conversationId)

    this.logger.info(`App user left the conversation. conversationId: ${conversationId}`)
  }

  private async isGroupConversation(conversationId: QualifiedId): Promise<boolean> {
    const conversation = await this.getConversationById(conversationId)
    return conversation.type === ConversationType.GROUP
  }

  private async isAppUserMemberOfConversation(conversationId: QualifiedId): Promise<boolean> {
    const appQualifiedId = this.getApplicationQualifiedId()
    const members = this.getMembersByConversationId(conversationId)
    return members.some(
      (member) => member.userId.id === appQualifiedId.id && member.userId.domain === appQualifiedId.domain
    )
  }

  /**
   * Resets the MLS group of a conversation. Called when receiving a conversation.mls-reset event.
   * If the conversation already has the new MLS groupId, no-op (idempotent for duplicate events).
   * Otherwise wipes the old MLS group from CoreCrypto and deletes the conversation (and its
   * members) from local storage. It will be re-established on the next interaction.
   */
  async resetMlsConversation(conversationId: QualifiedId, newGroupId: string): Promise<void> {
    const conversationEntity = this.conversationRepository.findByIdAndDomain(conversationId.id, conversationId.domain)
    if (!conversationEntity) {
      this.logger.warn(
        `Conversation not found in storage during MLS reset. Already deleted? conversationId: ${conversationId}`
      )
      return
    }
    if (conversationEntity.mlsGroupId === newGroupId) {
      this.logger.info(
        `Conversation already has the new MLS Group ID, skipping reset. conversationId: ${conversationId}`
      )
      return
    }
    await this.deleteAllConversationDataFromLocalStorages(conversationId)
    this.logger.info(`MLS conversation reset is completed. conversationId: ${conversationId}`)
  }

  async deleteAllConversationDataFromLocalStorages(conversationId: QualifiedId): Promise<void> {
    this.logger.info(`Deleting all conversation data. conversationId: ${conversationId}`)
    const conversationEntity = this.conversationRepository.findByIdAndDomain(conversationId.id, conversationId.domain)

    if (conversationEntity?.mlsGroupId) {
      if (await this.coreCryptoService.conversationExists(conversationEntity.mlsGroupId)) {
        await this.coreCryptoService.wipeConversation(conversationEntity.mlsGroupId)
      }
    }

    this.conversationMemberRepository.deleteAllMembersInConversation(conversationId.id, conversationId.domain)
    this.conversationRepository.delete(conversationId.id, conversationId.domain)

    this.logger.info(`Deleted all conversation data. conversationId: ${conversationId}`)
  }

  async addMembersToConversation(
    conversationId: QualifiedId,
    members: QualifiedId[]
  ): Promise<AddMembersToConversationResult> {
    if (members.length === 0) {
      throw new InvalidParameterError(`List of members cannot be empty. conversationId: ${conversationId}`)
    }

    const conversation = await this.getConversationById(conversationId)

    this.requireConversationIsGroupOrChannel(conversationId, conversation.type)
    this.requireAppIsAdminInConversation(conversationId)

    let result: AddMembersToConversationResult
    try {
      result = await this.coreCryptoService.addClientsToMlsConversation(conversation.mlsGroupId, members)
    } catch (error) {
      throw new UnknownError('Unable to add members to MLS conversation.', error as Error)
    }

    const membersToSave: ConversationMemberEntity[] = result.membersAdded.map((userId) => ({
      userId: userId.id,
      userDomain: userId.domain,
      conversationId: conversationId.id,
      conversationDomain: conversationId.domain,
      role: ConversationRole.MEMBER,
      creationDate: null
    }))

    this.conversationMemberRepository.saveMany(membersToSave)

    this.logger.info(
      `${result.membersAdded.length} member(s) successfully added to the conversation. conversationId: ${conversationId}`
    )

    return result
  }

  async removeMembersFromConversation(
    conversationId: QualifiedId,
    members: QualifiedId[]
  ): Promise<RemoveMembersFromConversationResult> {
    this.logger.info(
      `Attempting to remove ${members.length} member(s) from the conversation. conversationId: ${conversationId}`
    )

    if (members.length === 0) {
      throw new InvalidParameterError(`List of members cannot be empty. conversationId: ${conversationId}`)
    }

    const conversation = await this.getConversationById(conversationId)
    this.requireConversationIsGroupOrChannel(conversationId, conversation.type)
    this.requireAppIsAdminInConversation(conversationId)

    const membersInTheConversation = this.filterMembersInConversation(conversationId, members)
    if (membersInTheConversation.length === 0) {
      this.logger.warn(`No valid members to remove from the conversation. conversationId: ${conversationId}`)
      return {membersRemoved: []}
    }

    const userIdToClientIds = await this.userService.getUsersClientIds(membersInTheConversation)
    if (userIdToClientIds.size === 0) {
      this.logger.warn(
        `All members have no clients, cannot remove from MLS conversation. conversationId: ${conversationId}`
      )
      return {membersRemoved: []}
    }

    const clientIdsToRemove = [...userIdToClientIds.values()].flat()

    try {
      const membersRemoved = [...userIdToClientIds.keys()].map(QualifiedId.fromKey)
      await this.coreCryptoService.removeClientsFromMlsConversation(conversation.mlsGroupId, clientIdsToRemove)
      this.conversationMemberRepository.deleteMany(membersRemoved, conversationId.id, conversationId.domain)
      this.logger.info(
        `Removal of members from the conversation is completed. Removed: ${membersRemoved.length}. conversationId: ${conversationId}`
      )
      return {membersRemoved}
    } catch (error) {
      this.logger.error('Failed to remove clients from MLS conversation.', error as Error)
      return {membersRemoved: []}
    }
  }

  private filterMembersInConversation(conversationId: QualifiedId, members: QualifiedId[]): QualifiedId[] {
    const membersInConversation: QualifiedId[] = []

    for (const member of members) {
      const isMemberInConversation = this.conversationMemberRepository.exists(
        member.id,
        member.domain,
        conversationId.id,
        conversationId.domain
      )
      if (isMemberInConversation) {
        membersInConversation.push(member)
      } else {
        this.logger.warn(`Member is not in the conversation. conversationId: ${conversationId}, userId: ${member}`)
      }
    }

    return membersInConversation
  }

  async updateConversationMemberRole(
    conversationId: QualifiedId,
    userId: QualifiedId,
    newRole: ConversationRole
  ): Promise<void> {
    this.logger.info(
      `Updating member in conversation. conversationId: ${conversationId}, userId: ${userId}, newRole: ${newRole}`
    )

    const conversation = await this.getConversationById(conversationId)
    this.requireConversationIsGroupOrChannel(conversationId, conversation.type)
    this.requireAppIsAdminInConversation(conversationId)
    this.requireUserIsInConversation(conversationId, userId)

    await this.conversationsApiClient.updateConversationMemberRole(conversationId, userId, newRole)

    const memberToSave: ConversationMemberEntity = {
      userId: userId.id,
      userDomain: userId.domain,
      conversationId: conversationId.id,
      conversationDomain: conversationId.domain,
      role: newRole,
      creationDate: null
    }

    this.conversationMemberRepository.save(memberToSave)

    this.logger.info(
      `Updated member in conversation. conversationId: ${conversationId}, userId: ${userId}, newRole: ${newRole}`
    )
  }

  async syncMemberUpdate(userId: QualifiedId, conversationId: QualifiedId, newRole: ConversationRole): Promise<void> {
    this.logger.info(
      `Syncing member in conversation. conversationId: ${conversationId}, userId: ${userId}, newRole: ${newRole}`
    )

    if (this.conversationRepository.findByIdAndDomain(conversationId.id, conversationId.domain) == null) {
      this.logger.warn(
        `Conversation does not exist locally. Skipping updating member for conversationId: ${conversationId}, userId: ${userId}`
      )
      return
    }

    const memberEntity: ConversationMemberEntity = {
      userId: userId.id,
      userDomain: userId.domain,
      conversationId: conversationId.id,
      conversationDomain: conversationId.domain,
      role: newRole,
      creationDate: null
    }

    this.conversationMemberRepository.save(memberEntity)
    this.logger.info(
      `Synced member in conversation. conversationId: ${conversationId}, userId: ${userId}, newRole: ${newRole}`
    )
  }

  async syncMembersAdded(members: ConversationMember[], conversationId: QualifiedId): Promise<void> {
    this.logger.info(
      `Adding members to conversation. conversationId: ${conversationId}, members length: ${members.length}`
    )

    // TODO: Baris: In such cases we should throw custom exceptions and handle them in the upper layers instead of just logging and skipping the events.
    //  For example for this scenario, the Router class should not call the callback method if we didn't add the members to the conversation
    if (this.conversationRepository.findByIdAndDomain(conversationId.id, conversationId.domain) == null) {
      this.logger.warn(
        `Conversation does not exist locally. Skipping MemberJoin event for conversationId: ${conversationId}`
      )
      return
    }

    const membersToSave: ConversationMemberEntity[] = members.map((member) => {
      return {
        userId: member.userId.id,
        userDomain: member.userId.domain,
        conversationId: conversationId.id,
        conversationDomain: conversationId.domain,
        role: member.role,
        creationDate: null
      }
    })

    this.conversationMemberRepository.saveMany(membersToSave)
    this.logger.info(
      `Added members to conversation. conversationId: ${conversationId}, members length: ${members.length}`
    )
  }

  async syncMembersRemoved(userIds: QualifiedId[], conversationId: QualifiedId): Promise<void> {
    this.logger.info(
      `Removing members from conversation. conversationId: ${conversationId}, userIds length: ${userIds.length}`
    )

    if (this.conversationRepository.findByIdAndDomain(conversationId.id, conversationId.domain) == null) {
      this.logger.warn(
        `Conversation does not exist locally. Skipping MemberLeave event for conversationId: ${conversationId}`
      )
      return
    }

    if (this.containsAppUser(userIds)) {
      this.logger.info(
        `List of members to be removed contains the Wire user. Deleting all conversation data for conversationId: ${conversationId}`
      )
      await this.deleteAllConversationDataFromLocalStorages(conversationId)
    } else {
      this.conversationMemberRepository.deleteMany(userIds, conversationId.id, conversationId.domain)
    }
    this.logger.info(
      `Removed members from conversation. conversationId: ${conversationId}, userIds length: ${userIds.length}`
    )
  }

  private containsAppUser(userIds: QualifiedId[]): boolean {
    const appQualifiedId = this.getApplicationQualifiedId()
    return userIds.some((user) => user.id === appQualifiedId.id && user.domain === appQualifiedId.domain)
  }

  async establishOrRejoinConversations(): Promise<void> {
    const shouldRejoinConversations = this.appProperties.getShouldRejoinConversations()
    if (!shouldRejoinConversations) {
      this.logger.info('Skipping re-joining conversations as its not needed.')
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

      const mlsConversations = conversations.filter((conversation) => conversation.protocol === CryptoProtocol.MLS)

      for (const conversation of mlsConversations) {
        await this.establishOrJoinMlsConversation(conversation)
      }

      startIndex += sliceSize
      endIndex += sliceSize
    } while (endIndex < allConversationIds.length + sliceSize)

    this.appProperties.setShouldRejoinConversations(false)
  }

  private async establishOrJoinMlsConversation(conversation: ConversationResponse): Promise<void> {
    if (!conversation.group_id) {
      this.logger.warn(
        `Skipping MLS conversation setup. mlsGroupId is null. conversationId: ${obfuscateId(conversation.qualified_id.id)}`
      )
      return
    }

    if (await this.coreCryptoService.conversationExists(conversation.group_id)) {
      this.logger.info(`Conversation ${obfuscateId(conversation.qualified_id.id)} already exists, skipping it`)
      return
    }

    const isAlreadyEstablishedMlsConversation = conversation.epoch != null && conversation.epoch !== 0
    if (isAlreadyEstablishedMlsConversation) {
      const conversationGroupInfoBytes = await this.conversationsApiClient.getConversationGroupInfo(
        conversation.qualified_id
      )
      await this.coreCryptoService.joinMlsConversation(conversationGroupInfoBytes)
      await this.saveConversationWithMembers(conversation.qualified_id, conversation)
    } else if (conversation.type === ConversationType.SELF) {
      await this.coreCryptoService.establishMlsConversation(conversation.group_id)
    }
  }

  async deleteConversation(conversationId: QualifiedId): Promise<void> {
    this.logger.info(`Attempting to delete conversation. conversationId: ${conversationId}`)
    const conversation = await this.getConversationById(conversationId)

    if (!conversation.teamId) {
      throw new InvalidParameterError(`Conversation teamId must not be null. conversationId: ${conversationId}`)
    }

    this.requireConversationIsGroupOrChannel(conversationId, conversation.type)
    this.requireAppIsAdminInConversation(conversationId)

    const teamId = new TeamId(conversation.teamId)
    await this.teamsApiClient.deleteConversation(teamId, conversationId)
    await this.deleteAllConversationDataFromLocalStorages(conversationId)

    this.logger.info(`Conversation is deleted. teamId: ${teamId}, conversationId: ${conversationId}`)
  }

  private requireConversationIsGroupOrChannel(conversationId: QualifiedId, conversationType: ConversationType): void {
    if (conversationType !== ConversationType.GROUP) {
      this.logger.warn(
        `Skipping operation, conversation is not a GROUP or CHANNEL. conversationId: ${conversationId}, conversationType: ${conversationType}`
      )
      throw new InvalidParameterError(`Conversation type is not GROUP. conversationId: ${conversationId}`)
    }
  }

  private requireAppIsAdminInConversation(conversationId: QualifiedId): void {
    const appQualifiedId = this.getApplicationQualifiedId()
    const members = this.getMembersByConversationId(conversationId)
    const isAppAdminInConversation = members.some(
      (member) =>
        member.userId.id === appQualifiedId.id &&
        member.userId.domain === appQualifiedId.domain &&
        member.role === ConversationRole.ADMIN
    )

    if (!isAppAdminInConversation) {
      this.logger.warn(
        `App user is not an admin in the conversation. conversationId: ${obfuscateId(conversationId.id)}, appUserId: ${obfuscateId(appQualifiedId.id)}`
      )
      throw ForbiddenError.appIsNotAdminInConversation()
    }
  }

  private requireUserIsInConversation(conversationId: QualifiedId, userId: QualifiedId): void {
    const exists = this.conversationMemberRepository.exists(
      userId.id,
      userId.domain,
      conversationId.id,
      conversationId.domain
    )

    if (!exists) {
      this.logger.warn(`User is not in the conversation. conversationId: ${conversationId}, userId: ${userId}`)
      throw ForbiddenError.appIsNotInConversation()
    }
  }
}
