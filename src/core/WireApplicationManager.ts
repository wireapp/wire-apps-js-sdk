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

import {MlsService} from "../api/MlsService.js";
import {ProtobufSerializer} from "../mappers/protobuf/ProtobufSerializer.js";
import type {AssetRemoteData, WireMessage} from "../model/WireMessage.js";
import {AssetMessage} from "../model/WireMessage.js"
import {CoreCryptoService} from "./CoreCryptoService.js";
import {ConversationService} from "../api/ConversationService.js";
import {singleton} from "tsyringe";
import type {QualifiedId} from "../model/QualifiedId.js";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import {obfuscateId} from "../utils/ObfuscateUtil.js";
import {AssetsTransferService} from "../api/AssetsTransferService.js";
import type {Asset} from "../model/Asset.js";
import type {ConversationRole} from "../model/conversation/ConversationRole.js";
import {UserService} from "../api/UserService.js";
import type {Conversation} from "../model/conversation/Conversation.js";
import type {ConversationMember} from "../model/conversation/ConversationMember.js";
import type {RemoveMembersFromConversationResult} from "../api/model/RemoveMembersFromConversationResult.js";
import type {AddMembersToConversationResult} from "../api/model/AddMembersToConversationResult.js";
import type {WireUser} from "../model/WireUser.js";

@singleton()
export class WireApplicationManager {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  constructor(
    private coreCryptoService: CoreCryptoService,
    private conversationService: ConversationService,
    private mlsService: MlsService,
    private assetsTransferService: AssetsTransferService,
    private userService: UserService
  ) {
  }

  async sendMessage(message: WireMessage): Promise<string> {
    const mlsGroupId =
      await this.conversationService.getConversationMLSGroupId(message.conversationId)

    const protobufMessage = ProtobufSerializer.toGenericMessageByteArray(message)
    const encryptedMessage = await this.coreCryptoService.encryptMls(
      mlsGroupId,
      protobufMessage
    )

    await this.mlsService.sendMessage(encryptedMessage)

    return message.id
  }

  async downloadAsset(assetRemoteData: AssetRemoteData): Promise<Uint8Array> {
    return await this.assetsTransferService.downloadAsset(assetRemoteData)
  }

  async sendAsset(
    conversationId: QualifiedId,
    asset: Asset
  ): Promise<string> {
    const remoteData = await this.assetsTransferService.uploadAssetForSending(asset.data)

    const assetMessage = AssetMessage.create({
      conversationId: conversationId,
      metadata: asset.metadata ?? null,
      mimeType: asset.mimeType,
      name: asset.name,
      remoteData: remoteData,
      sizeInBytes: asset.data.length
    })

    return await this.sendMessage(assetMessage)
  }

  async leaveConversation(conversationId: QualifiedId): Promise<void> {
    this.logger.debug('App requested to leave the conversation with id: ' + obfuscateId(conversationId.id));

    await this.conversationService.leaveConversation(conversationId);

    this.logger.debug('App left the conversation with id: ' + obfuscateId(conversationId.id));
  }

  async deleteConversation(conversationId: QualifiedId): Promise<void> {
    this.logger.debug('App requested to delete the conversation with id: ' + obfuscateId(conversationId.id));
    await this.conversationService.deleteConversation(conversationId);
    this.logger.debug('App deleted the conversation with id: ' + obfuscateId(conversationId.id));
  }

  async addMembersToConversation(conversationId: QualifiedId, members: QualifiedId[]): Promise<AddMembersToConversationResult> {
    this.logger.debug('App requested to add members to the conversation with id: ' + obfuscateId(conversationId.id));
    const result = await this.conversationService.addMembersToConversation(conversationId, members);
    this.logger.debug('Members added to the conversation with id: ' + obfuscateId(conversationId.id));
    return result;
  }

  async removeMembersFromConversation(conversationId: QualifiedId, members: QualifiedId[]): Promise<RemoveMembersFromConversationResult> {
    this.logger.debug('App requested to remove members from the conversation with id: ' + obfuscateId(conversationId.id));
    const result = await this.conversationService.removeMembersFromConversation(conversationId, members);
    this.logger.debug('Members removed from the conversation with id: ' + obfuscateId(conversationId.id));
    return result;
  }

  async updateConversationMemberRole(conversationId: QualifiedId, userId: QualifiedId, newRole: ConversationRole): Promise<void> {
    this.logger.debug('App requested to update member\'s role in the conversation with id: ' + obfuscateId(conversationId.id));
    await this.conversationService.updateConversationMemberRole(conversationId, userId, newRole);
    this.logger.debug('Member\'s role is updated in the conversation with id: ' + obfuscateId(conversationId.id));
  }

  async getUser(userQualifiedId: QualifiedId): Promise<WireUser> {
    this.logger.debug('App requested to get user info: ' + obfuscateId(userQualifiedId.id));
    return await this.userService.getUser(userQualifiedId)
  }

  async getAllConversations(): Promise<Conversation[]> {
    this.logger.debug('App requested to get all conversations')
    return this.conversationService.getAllConversations()
  }

  async getMembersInConversation(conversationId: QualifiedId): Promise<ConversationMember[]> {
    this.logger.debug('App requested to get members of conversation. ConversationId: ' + obfuscateId(conversationId.id));
    return this.conversationService.getMembersByConversationId(conversationId)
  }
}
