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

import {Reaction, Receipt, ReceiptType, TextMessage, WireEventsHandler} from '@wireapp/wire-apps-js-sdk'
import {exampleLogger} from '../ExampleLogger.js'

/**
 * This example demonstrates how to react to a received text message by sending a read receipt and adding emoji reactions.
 * When a text message is received, the app will automatically send a read receipt to acknowledge that the message was seen,
 * and then it will react to the message with a set of emojis.
 */
export class ReadAndReactOnTextMsgReceivedExample extends WireEventsHandler {
  public override async onTextMessageReceived(wireMessage: TextMessage): Promise<void> {
    // Step 1: Send a read receipt so the sender knows the message was seen
    await this.sendReadReceipt(wireMessage)

    // Step 2: React to the message with emojis
    await this.reactToMessage(wireMessage)
  }

  private async sendReadReceipt(wireMessage: TextMessage): Promise<void> {
    const readReceipt = Receipt.create({
      conversationId: wireMessage.conversationId,
      receiptType: ReceiptType.READ,
      messageIds: [wireMessage.id]
    })

    await this.manager.sendMessage(readReceipt)
    exampleLogger.info(`Read receipt sent. conversationId: ${wireMessage.conversationId}`)
  }

  private async reactToMessage(wireMessage: TextMessage): Promise<void> {
    const reaction = Reaction.create({
      conversationId: wireMessage.conversationId,
      messageId: wireMessage.id,
      emojiSet: new Set<string>(['🎉', '🙂', '🧩'])
    })

    await this.manager.sendMessage(reaction)
    exampleLogger.info(`Reactions sent. conversationId: ${wireMessage.conversationId}`)
  }
}
