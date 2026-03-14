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

import {WireApplicationManager} from "./WireApplicationManager.js";
import type {
  AssetMessage,
  ButtonActionConfirmationMessage,
  ButtonActionMessage,
  CompositeMessage,
  ConfirmationMessage,
  KnockMessage,
  LocationMessage,
  MessageDeleteMessage,
  MessageEditMessage,
  ReactionMessage,
  TextMessage,
} from "../model/WireMessage.js";
import type {Conversation} from "../model/conversation/Conversation.js";
import type {ConversationMember} from "../model/conversation/ConversationMember.js";
import {obfuscateId} from "../utils/ObfuscateUtil.js";
import {container} from "tsyringe";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import type {QualifiedId} from "../model/QualifiedId.js";

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

  public async onAssetMessageReceived(wireMessage: AssetMessage): Promise<void> {
    this.logger.info(`Received onAssetMessageReceived, ID: ${wireMessage.id}`)
  }

  /**
   * Called when a Composite (interactive UI card) message is received.
   * Composite messages contain a mix of text paragraphs and tappable buttons.
   * When a user taps a button, a ButtonAction event will follow.
   */
  public async onCompositeMessageReceived(wireMessage: CompositeMessage): Promise<void> {
    this.logger.info(`Received onCompositeMessageReceived, ID: ${wireMessage.id}`)
  }

  /**
   * Called when a user taps a button inside a Composite message.
   * Use `referenceMessageId` to identify which Composite message the action belongs to.
   * Respond by sending a ButtonActionConfirmation via `manager.sendMessage()`.
   */
  public async onButtonActionReceived(wireMessage: ButtonActionMessage): Promise<void> {
    this.logger.info(`Received onButtonActionReceived, ID: ${wireMessage.id}`)
  }

  /**
   * Called when the server or bot confirms which button was accepted in response
   * to a ButtonAction. If `buttonId` is absent, no button was accepted.
   */
  public async onButtonActionConfirmationReceived(wireMessage: ButtonActionConfirmationMessage): Promise<void> {
    this.logger.info(`Received onButtonActionConfirmationReceived, ID: ${wireMessage.id}`)
  }

  /**
   * Called when a knock/ping message is received to get attention in a conversation.
   */
  public async onKnockReceived(wireMessage: KnockMessage): Promise<void> {
    this.logger.info(`Received onKnockReceived, ID: ${wireMessage.id}`)
  }

  /**
   * Called when a location message is received.
   */
  public async onLocationMessageReceived(wireMessage: LocationMessage): Promise<void> {
    this.logger.info(`Received onLocationMessageReceived, ID: ${wireMessage.id}`)
  }

  /**
   * Called when an emoji reaction is sent to a message.
   * An empty `emoji` string means the sender removed their reaction.
   */
  public async onReactionReceived(wireMessage: ReactionMessage): Promise<void> {
    this.logger.info(`Received onReactionReceived, ID: ${wireMessage.id}`)
  }

  /**
   * Called when a message has been deleted by its sender.
   */
  public async onMessageDeleted(wireMessage: MessageDeleteMessage): Promise<void> {
    this.logger.info(`Received onMessageDeleted, ID: ${wireMessage.id}`)
  }

  /**
   * Called when an existing message has been edited.
   * The `replacingMessageId` identifies the original message.
   */
  public async onMessageEdited(wireMessage: MessageEditMessage): Promise<void> {
    this.logger.info(`Received onMessageEdited, ID: ${wireMessage.id}`)
  }

  /**
   * Called when a delivery or read confirmation is received for one or more messages.
   */
  public async onConfirmationReceived(wireMessage: ConfirmationMessage): Promise<void> {
    this.logger.info(`Received onConfirmationReceived, ID: ${wireMessage.id}, type: ${wireMessage.confirmationType}`)
  }

  public async onAppAddedToConversation(
    conversation: Conversation,
    members: ConversationMember[]
  ): Promise<void> {
    this.logger.info(`Received onAppAddedToConversation, ID: ${obfuscateId(conversation.id)} - length: ${members.length}`)
  }

  public async onConversationDeleted(
    conversationId: QualifiedId
  ): Promise<void> {
    this.logger.info(`Received onConversationDeleted, ID: ${obfuscateId(conversationId.id)}`)
  }

  public async onUserJoinedConversation(
    conversationId: QualifiedId,
    members: ConversationMember[]
  ): Promise<void> {
    this.logger.info(`Received onUserJoinedConversation, ID: ${obfuscateId(conversationId.id)} - length: ${members.length}`)
  }

  public async onUserLeftConversation(
    conversationId: QualifiedId,
    members: QualifiedId[]
  ): Promise<void> {
    this.logger.info(`Received onUserLeftConversation, ID: ${obfuscateId(conversationId.id)} - length: ${members.length}`)
  }
}
