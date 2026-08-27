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
import {QualifiedId, WireAppSdk, type WireApplicationManager} from '@wireapp/wire-apps-js-sdk'
import {CRYPTOGRAPHY_STORAGE_KEY, WIRE_API_HOST, WIRE_API_TOKEN} from '../ExampleConfig.js'
import {exampleLogger} from '../ExampleLogger.js'
import {NoOpWireEventsHandler} from './NoOpWireEventsHandler.js'

/**
 * This example collects all user IDs from the conversations that the app is involved in.
 * And then creates a new group conversation with those users as members.
 */
class CreateGroupConversationExample {
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

    // Listening establishes/rejoins the app's conversations, which is required
    // before their content can be read or new conversations can be created.
    await sdk.startListening()
    this.manager = sdk.getApplicationManager()

    try {
      await this.createGroupWithAll()
    } finally {
      await sdk.close()
    }
  }

  /**
   * This method creates a new group conversation with all users that are together with the app
   * in the same conversations.
   */
  private async createGroupWithAll(): Promise<void> {
    const userIds = await this.getAllUsersInMyConversations()

    if (userIds.length === 0) {
      exampleLogger.warn('No other users found in the stored conversations. Nothing to do.')
      return
    }

    const conversationId = await this.manager.createGroupConversation(`groupWithAll_${Date.now()}`, userIds)
    exampleLogger.info(`Group conversation created with ${userIds.length} member(s). conversationId: ${conversationId}`)
  }

  /**
   * This method collects all user IDs from the conversations stored in the application.
   */
  private async getAllUsersInMyConversations(): Promise<QualifiedId[]> {
    const applicationId = this.manager.getApplicationQualifiedId()
    const userIdsByKey = new Map<string, QualifiedId>()

    // Iterate all stored conversations and collect all member user IDs
    for (const conversation of await this.manager.getAllConversations()) {
      const members = await this.manager.getMembersInConversation(new QualifiedId(conversation.id, conversation.domain))

      for (const member of members) {
        // The app creates the new conversation, so it must not be added as a member
        if (QualifiedId.equals(member.userId, applicationId)) {
          continue
        }
        userIdsByKey.set(QualifiedId.toKey(member.userId), member.userId)
      }
    }

    return [...userIdsByKey.values()]
  }
}

await new CreateGroupConversationExample().run()
