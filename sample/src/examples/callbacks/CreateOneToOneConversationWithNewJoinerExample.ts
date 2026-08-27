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
  type ConversationMember,
  obfuscateId,
  QualifiedId,
  TextMessage,
  WireEventsHandler
} from '@wireapp/wire-apps-js-sdk'
import {exampleLogger} from '../ExampleLogger.js'

/**
 * This example demonstrates how to create a one-to-one conversation with a user who
 * just joined a conversation and send them a welcome message in that one-to-one conversation.
 */
export class CreateOneToOneConversationWithNewJoinerExample extends WireEventsHandler {
  public override async onUserJoinedConversation(
    conversationId: QualifiedId,
    members: ConversationMember[]
  ): Promise<void> {
    exampleLogger.info(
      `User(s) joined conversation. conversationId: ${obfuscateId(conversationId.id)}, membersCount: ${members.length}`
    )

    for (const member of members) {
      const oneToOneConversationId = await this.createOneToOneConversation(member.userId)
      await this.sendMessageToOneToOneConversation(oneToOneConversationId)
    }
  }

  private async createOneToOneConversation(userId: QualifiedId): Promise<QualifiedId> {
    return await this.manager.createOneToOneConversation(userId)
  }

  private async sendMessageToOneToOneConversation(oneToOneConversationId: QualifiedId): Promise<void> {
    const message = TextMessage.create({
      conversationId: oneToOneConversationId,
      text: '👋 Hey! I created this 1-1 conversation to welcome you! Feel free to ask me anything here.'
    })

    await this.manager.sendMessage(message)
    exampleLogger.info(`Welcome message sent. conversationId: ${oneToOneConversationId}`)
  }
}
