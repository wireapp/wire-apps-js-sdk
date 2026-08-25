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

import {WireApplicationManager} from './WireApplicationManager.js'
import type {
  AssetMessage,
  CompositeButtonAction,
  DeletedMessage,
  Location,
  Ping,
  Reaction,
  Receipt,
  TextMessage,
  TextEditedMessage
} from '../model/WireMessage.js'
import type {Conversation} from '../model/conversation/Conversation.js'
import type {ConversationMember} from '../model/conversation/ConversationMember.js'
import {obfuscateId} from '../utils/ObfuscateUtil.js'
import {container} from 'tsyringe'
import {LoggerFactory} from '../utils/logger/LoggerFactory.js'
import type {QualifiedId} from '../model/QualifiedId.js'

/**
 * Abstract class exposed by the SDK to handle events.
 */
export abstract class WireEventsHandler {
  private logger = LoggerFactory.getLogger(this.constructor.name)
  private _manager?: WireApplicationManager

  /**
   * The WireApplicationManager is used to manage the Wire application lifecycle and
   * communication with the backend.
   * NOTE: Do not use manager in the constructor of this class, as it will be null at that time.
   * Use it only inside the event handling methods.
   */
  public get manager(): WireApplicationManager {
    if (!this._manager) {
      this._manager = container.resolve(WireApplicationManager)
    }
    return this._manager
  }

  public async onTextMessageReceived(wireMessage: TextMessage): Promise<void> {
    this.logger.info(`Received onTextMessageReceived, ID: ${wireMessage.id}`)
  }

  public async onTextEditedMessageReceived(wireMessage: TextEditedMessage): Promise<void> {
    this.logger.info(`Received onTextEditedMessageReceived, ID: ${wireMessage.id}`)
  }

  public async onAssetMessageReceived(wireMessage: AssetMessage): Promise<void> {
    this.logger.info(`Received onAssetMessageReceived, ID: ${wireMessage.id}`)
  }

  public async onButtonClicked(wireMessage: CompositeButtonAction): Promise<void> {
    this.logger.info(`Received onButtonClicked, ID: ${wireMessage.id}`)
  }

  public async onPingReceived(wireMessage: Ping): Promise<void> {
    this.logger.info(`Received onPingReceived, ID: ${wireMessage.id}`)
  }

  public async onLocationMessageReceived(wireMessage: Location): Promise<void> {
    this.logger.info(`Received onLocationMessageReceived, ID: ${wireMessage.id}`)
  }

  public async onMessageDeleted(wireMessage: DeletedMessage): Promise<void> {
    this.logger.info(`Received onMessageDeleted, ID: ${wireMessage.id}`)
  }

  public async onMessageDelivered(wireMessage: Receipt): Promise<void> {
    this.logger.info(`Received onMessageDelivered, ID: ${wireMessage.id}`)
  }

  public async onMessageReactionReceived(wireMessage: Reaction): Promise<void> {
    this.logger.info(`Received onMessageReactionReceived, ID: ${wireMessage.id}`)
  }

  public async onAppAddedToConversation(conversation: Conversation, members: ConversationMember[]): Promise<void> {
    this.logger.info(
      `Received onAppAddedToConversation, ID: ${obfuscateId(conversation.id)} - length: ${members.length}`
    )
  }

  public async onConversationDeleted(conversationId: QualifiedId): Promise<void> {
    this.logger.info(`Received onConversationDeleted, ID: ${obfuscateId(conversationId.id)}`)
  }

  public async onUserJoinedConversation(conversationId: QualifiedId, members: ConversationMember[]): Promise<void> {
    this.logger.info(
      `Received onUserJoinedConversation, ID: ${obfuscateId(conversationId.id)} - length: ${members.length}`
    )
  }

  public async onUserLeftConversation(conversationId: QualifiedId, members: QualifiedId[]): Promise<void> {
    this.logger.info(
      `Received onUserLeftConversation, ID: ${obfuscateId(conversationId.id)} - length: ${members.length}`
    )
  }
}
