/*
 * Wire
 * Copyright (C) 2026 Wire Swiss GmbH
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

import {
  type Conversation,
  type ConversationMember,
  obfuscateId,
  QualifiedId,
  TextMessage,
  WireEventsHandler
} from '@wireapp/wire-apps-js-sdk'
import {exampleLogger} from '../ExampleLogger.js'

/**
 * This example demonstrates how to greet a conversation when the app is added to it.
 * The app listens for the event of being added to a conversation and sends a greeting message in response.
 */
export class GreetConversationOnAppAddedExample extends WireEventsHandler {
  public override async onAppAddedToConversation(
    conversation: Conversation,
    members: ConversationMember[]
  ): Promise<void> {
    exampleLogger.info(
      `App added to conversation. conversationId: ${obfuscateId(conversation.id)}, membersCount: ${members.length}`
    )

    await this.sendGreetingsToConversation(new QualifiedId(conversation.id, conversation.domain))
  }

  private async sendGreetingsToConversation(conversationId: QualifiedId): Promise<void> {
    const wireMessage = TextMessage.create({
      conversationId: conversationId,
      text: '**Hey! Thanks for adding me in your conversation** 🙂'
    })

    await this.manager.sendMessage(wireMessage)
    exampleLogger.info(`Welcome message sent. conversationId: ${conversationId}`)
  }
}
