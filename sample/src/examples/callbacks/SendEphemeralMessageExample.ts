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

import {type QualifiedId, TextMessage, WireEventsHandler} from '@wireapp/wire-apps-js-sdk'
import {exampleLogger} from '../ExampleLogger.js'

/**
 * This example demonstrates how to send an ephemeral message that will be automatically deleted after a specified duration.
 * When the app receives a text message containing "send me the password",
 * it responds with an ephemeral message that includes a password and expires after 10 seconds.
 */
export class SendEphemeralMessageExample extends WireEventsHandler {
  private static readonly EXPIRES_AFTER_MILLIS = 10_000

  public override async onTextMessageReceived(wireMessage: TextMessage): Promise<void> {
    if (wireMessage.text.toLowerCase().includes('send me the password')) {
      await this.sendEphemeralTextMessage(wireMessage.conversationId)
    }
  }

  private async sendEphemeralTextMessage(conversationId: QualifiedId): Promise<void> {
    const message = TextMessage.create({
      conversationId: conversationId,
      text: 'My password is: 1234_5678. This message will be deleted in 10 seconds!!',
      expiresAfterMillis: SendEphemeralMessageExample.EXPIRES_AFTER_MILLIS
    })

    await this.manager.sendMessage(message)
    exampleLogger.info(`Ephemeral message sent. conversationId: ${conversationId}`)
  }
}
