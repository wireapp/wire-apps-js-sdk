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

import 'reflect-metadata'
import {QualifiedId, TextMessage, WireAppSdk, type WireApplicationManager} from '@wireapp/wire-apps-js-sdk'
import {CRYPTOGRAPHY_STORAGE_KEY, WIRE_API_HOST, WIRE_API_TOKEN} from '../ExampleConfig.js'
import {exampleLogger} from '../ExampleLogger.js'
import {NoOpWireEventsHandler} from './NoOpWireEventsHandler.js'

/**
 * This example demonstrates how to send a broadcast announcement message to all stored conversations
 * every 5 seconds, for a total of 2 times.
 */
class SendMessageToAllConversationsExample {
  private static readonly ANNOUNCEMENT_COUNT = 2
  private static readonly DELAY_BETWEEN_ANNOUNCEMENTS_MS = 5_000

  private manager!: WireApplicationManager

  public async run(): Promise<void> {
    const sdk = await WireAppSdk.create(
      WIRE_API_TOKEN,
      WIRE_API_HOST,
      CRYPTOGRAPHY_STORAGE_KEY,
      // We use a no-op event handler since we don't need to react to any events in this example
      new NoOpWireEventsHandler(),
      exampleLogger
    )

    // Listening establishes/rejoins the app's conversations, which is required before sending
    // messages into them.
    await sdk.startListening()
    this.manager = sdk.getApplicationManager()

    try {
      await this.broadcastToAllConversations()
    } finally {
      await sdk.close()
    }
  }

  /**
   * This method sends a broadcast announcement message
   * to all stored conversations every 5 seconds, for a total of 2 times.
   */
  private async broadcastToAllConversations(): Promise<void> {
    const announcementText =
      '📣 **[Broadcast announcement]**' +
      '\n🚧 🚧 Maintenance is scheduled for 01.01.2035 from 01:00 to 03:00 UTC. ' +
      'During this time, the service may be unavailable.'

    for (let round = 1; round <= SendMessageToAllConversationsExample.ANNOUNCEMENT_COUNT; round++) {
      const conversations = await this.manager.getAllConversations()
      exampleLogger.info(
        `Broadcasting announcement ${round}/${SendMessageToAllConversationsExample.ANNOUNCEMENT_COUNT} ` +
          `to ${conversations.length} conversation(s)`
      )

      for (const conversation of conversations) {
        const conversationId = new QualifiedId(conversation.id, conversation.domain)
        const message = TextMessage.create({
          conversationId: conversationId,
          text: announcementText
        })

        // A broadcast must not be aborted because a single conversation cannot be delivered to.
        // Sending can fail per conversation, for example when the MLS group is not usable at the moment
        // ("Can't create message because a pending proposal exists."), so we log it and keep going with
        // the remaining conversations instead of letting the error bubble up and kill the application.
        try {
          await this.manager.sendMessage(message)
        } catch (error) {
          exampleLogger.warn(
            `Skipping conversation, sending the announcement failed. conversationId: ${conversationId}`,
            error as Error
          )
        }
      }

      if (round < SendMessageToAllConversationsExample.ANNOUNCEMENT_COUNT) {
        // Wait before sending the next announcement
        await this.delay(SendMessageToAllConversationsExample.DELAY_BETWEEN_ANNOUNCEMENTS_MS)
      }
    }
  }

  private async delay(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
  }
}

await new SendMessageToAllConversationsExample().run()
