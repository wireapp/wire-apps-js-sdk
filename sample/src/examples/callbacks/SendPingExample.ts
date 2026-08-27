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

import {Ping, type QualifiedId, TextMessage, WireEventsHandler} from '@wireapp/wire-apps-js-sdk'
import {exampleLogger} from '../ExampleLogger.js'

/**
 * This example demonstrates how to send a Ping message in response to receiving a text message containing "ping me".
 * When a text message is received, the handler checks if the message contains the phrase "ping me".
 * If it does, it creates and sends a Ping message to the same conversation.
 */
export class SendPingExample extends WireEventsHandler {
  public override async onTextMessageReceived(wireMessage: TextMessage): Promise<void> {
    if (wireMessage.text.toLowerCase().includes('ping me')) {
      await this.sendPing(wireMessage.conversationId)
    }
  }

  private async sendPing(conversationId: QualifiedId): Promise<void> {
    const ping = Ping.create({
      conversationId: conversationId
    })

    await this.manager.sendMessage(ping)
    exampleLogger.info(`Ping sent. conversationId: ${conversationId}`)
  }
}
