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
 * This example demonstrates how to greet new joiners in a conversation by sending a welcome message when they join.
 * It listens for the event of users joining a conversation and sends a personalized greeting message to each new member.
 */
export class GreetNewJoinerInConversationExample extends WireEventsHandler {
  public override async onUserJoinedConversation(
    conversationId: QualifiedId,
    members: ConversationMember[]
  ): Promise<void> {
    exampleLogger.info(
      `User(s) joined conversation. conversationId: ${obfuscateId(conversationId.id)}, membersCount: ${members.length}`
    )

    for (const member of members) {
      const user = await this.manager.getUser(member.userId)
      await this.welcomeTheNewJoiner(conversationId, user.name)
    }
  }

  private async welcomeTheNewJoiner(conversationId: QualifiedId, name: string): Promise<void> {
    const message = TextMessage.create({
      conversationId: conversationId,
      text: `👋Hey ${name}! Great to see you here!`
    })

    await this.manager.sendMessage(message)
    exampleLogger.info(`Welcome message sent to new joiner. conversationId: ${conversationId}`)
  }
}
