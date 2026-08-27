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

import {TextMessage, WireEventsHandler} from '@wireapp/wire-apps-js-sdk'
import {exampleLogger} from '../ExampleLogger.js'

/**
 * This example demonstrates how to reply to a received text message.
 * Whenever a text message is received, the app will reply with a predefined message.
 */
export class ReplyMessageExample extends WireEventsHandler {
  public override async onTextMessageReceived(wireMessage: TextMessage): Promise<void> {
    await this.sendReplyTo(wireMessage)
  }

  private async sendReplyTo(inReplyTo: TextMessage): Promise<void> {
    const reply = TextMessage.createReply({
      originalMessage: inReplyTo,
      text: `That's a great point 🙂Thanks. I will keep this in mind.`
    })

    await this.manager.sendMessage(reply)
    exampleLogger.info(`Reply sent. conversationId: ${inReplyTo.conversationId}`)
  }
}
