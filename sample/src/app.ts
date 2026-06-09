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

/* eslint-disable no-undef */

import "reflect-metadata";
import dotenv from 'dotenv';
import { PinoLogger } from './PinoLogger.js'
import {
  type Conversation,
  type ConversationMember,
  type ConversationRole,
  obfuscateId,
  QualifiedId,
  TextMessage,
  AssetMessage,
  CompositeButton,
  CompositeMessage,
  type Audio,
  type Image,
  type Video,
  WireAppSdk,
  WireEventsHandler,
  WireUser
} from 'wire-apps-js-sdk'
import fs from 'fs'
import path from 'node:path'

dotenv.config({ path: '../.env' })

const userId = process.env['WIRE_SDK_USER_ID'];
const apiToken = process.env['WIRE_SDK_API_TOKEN'];
const userDomain = process.env['WIRE_SDK_USER_DOMAIN'];
const apiHost = process.env['WIRE_SDK_API_HOST'];
const cryptographyStoragePassword = process.env['WIRE_SDK_CRYPTO_PASSWORD'];

if (!userId) {
  throw new Error('WIRE_SDK_USER_ID must be set in .env file');
}

if (!apiToken) {
  throw new Error('WIRE_SDK_API_TOKEN must be set in .env file');
}

if (!userDomain) {
  throw new Error('WIRE_SDK_USER_DOMAIN must be set in .env file');
}

if (!apiHost) {
  throw new Error('WIRE_SDK_API_HOST must be set in .env file');
}

if (!cryptographyStoragePassword) {
  throw new Error('WIRE_SDK_CRYPTO_PASSWORD must be set in .env file');
}

class SampleEventsHandler extends WireEventsHandler {
  public appLogger?: PinoLogger

  // TODO: Baris: We better handle asset related commands in reserved test commands section
  public override async onTextMessageReceived(wireMessage: TextMessage): Promise<void> {
    this.appLogger?.info(`[Sample App] Received message: ${wireMessage.text}`)
    if (this.isReservedTestCommand(wireMessage.text)) {
      await this.processReservedTestCommand(wireMessage.text, wireMessage.conversationId)
    } else if (wireMessage.text == "asset-image") {
      this.processAssetImage(wireMessage);
    } else if (wireMessage.text == "asset-audio") {
      this.processAssetAudio(wireMessage);
    } else if (wireMessage.text == "asset-video") {
      this.processAssetVideo(wireMessage);
    } else {
      const textMessage = TextMessage.create({
        conversationId: wireMessage.conversationId,
        text: `${wireMessage.text} -- Sent from the Sample SDK`,
        linkPreviews: wireMessage.linkPreviews,
        mentions: wireMessage.mentions
      })

      await this.manager.sendMessage(textMessage)
    }
  }

  public override async onConversationDeleted(conversationId: QualifiedId): Promise<void> {
    this.appLogger?.info(`[Sample App] A conversation was deleted: ${conversationId.id}@${conversationId.domain}`)
  }

  public override async onAppAddedToConversation(conversation: Conversation, members: ConversationMember[]): Promise<void> {
    this.appLogger?.info(`[Sample App] App was added to conversation: ${obfuscateId(conversation.id)} with ${members.length} members`)
    const textMessage = TextMessage.create({
      conversationId: new QualifiedId(conversation.id, conversation.domain),
      text: `Hello! I'm the Typescript SDK Sample App 🙂 I've just joined this conversation 👋`
    })
    await this.manager.sendMessage(textMessage)
  }

  public override async onUserJoinedConversation(conversationId: QualifiedId, members: ConversationMember[]): Promise<void> {
    this.appLogger?.info(`[Sample App] Users are added to conversation: ${obfuscateId(conversationId.id)} with ${members.length} members`)

    const textMessage = TextMessage.create({
      conversationId: conversationId,
      text: `🎉 Welcome ${members.map(m => obfuscateId(m.userId.id)).join(', ')}! 🎉`
    })
    await this.manager.sendMessage(textMessage)
  }

  public override async onUserLeftConversation(conversationId: QualifiedId, members: QualifiedId[]): Promise<void> {
    this.appLogger?.info(`[Sample App] User left the conversation: ${obfuscateId(conversationId.id)} - length: ${members.length}`)

    const textMessage = TextMessage.create({
      conversationId: conversationId,
      text: `Goodbye ${members.map(m => obfuscateId(m.id)).join(', ')}! 👋`
    })
    await this.manager.sendMessage(textMessage)
  }

  public override async onAssetMessageReceived(wireMessage: AssetMessage): Promise<void> {
    console.log(`[SampleEventsHandler] Received asset: ${wireMessage.name}`)
    if (!wireMessage.remoteData) return

    const asset = await this.manager.downloadAsset(wireMessage.remoteData)
    const filename = wireMessage.name ? wireMessage.name : `unknown-${crypto.randomUUID()}`
    const dir = 'build/downloaded_assets/'
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    const filePath = dir + filename;
    fs.writeFile(filePath, asset, (err) => {
      if (err) {
        console.log("There was an error writing the image")
      } else {
        console.log(`Downloaded asset with size: ${asset.length} bytes, saved to: ${filePath}`)
      }
    }
    )
  }

  private readonly RESOURCES_PATH = 'resources'

  private processAssetImage(wireMessage: TextMessage) {
    const filename = 'banana-icon.png'
    const filePath = path.join(this.RESOURCES_PATH, filename)
    fs.readFile(filePath, (err, data) => {
      if (err) {
        throw err;
      }

      const metadata: Image = {
        type: 'image',
        width: 240,
        height: 240
      }

      this.manager.sendAsset(
        wireMessage.conversationId,
        {
          data: data,
          name: filename,
          mimeType: "image/png",
          metadata: metadata
        }
      )
    });
  }

  private processAssetAudio(wireMessage: TextMessage) {
    const filename = 'sample_audio_6s.mp3'
    const filePath = path.join(this.RESOURCES_PATH, filename)
    fs.readFile(filePath, (err, data) => {
      if (err) {
        throw err;
      }

      const metadata: Audio = this.getSampleAudioMetadata()

      this.manager.sendAsset(
        wireMessage.conversationId,
        {
          data: data,
          name: filename,
          mimeType: "audio/mp3",
          metadata: metadata
        }
      )
    });
  }

  private getSampleAudioMetadata(): Audio {
    const base64Loudness = "/////////////////////////////////////8u+iP///8TCo///////l//////7" +
      "q3x6cXWAhIGOfn6KjouUi4SQlZGdkIeSm5OenoWFioqJnYZ/hIqOlJOIjZOanJSNkp2jqf///////" +
      "///////////////////////////////i3v///+ytIf/////1rfp/////8CWiHuDhYubk4SKi5GgnZ" +
      "COjJOlmpiQjJKmop6Jio2Pjp+MiYqKjpuQhIOFi5KUfoKKkJX/"

    return {
      type: 'audio',
      durationMs: 6000,
      normalizedLoudness: Buffer.from(base64Loudness, 'base64')
    }
  }

  private processAssetVideo(wireMessage: TextMessage) {
    const filename = 'sample_video_5s.mp4'
    const filePath = path.join(this.RESOURCES_PATH, filename)
    fs.readFile(filePath, (err, data) => {
      if (err) {
        throw err;
      }

      const metadata: Video = {
        type: 'video',
        width: 1920,
        height: 1080,
        durationMs: 5000
      }

      this.manager.sendAsset(
        wireMessage.conversationId,
        {
          data: data,
          name: filename,
          mimeType: "video/mp4",
          metadata: metadata
        }
      )
    });
  }

  // - - -  RESERVED TEST COMMANDS - - -
  private getReservedTestCommandHandlers(): Record<string, (conversationId: QualifiedId, command?: string) => Promise<void>> {
    return {
      'leave-group-conversation': async (conversationId) => {
        this.appLogger?.info(`[Sample App] Executing handler for: leave-group-conversation`)
        await this.manager.leaveConversation(conversationId)
      },
      'delete-group-conversation': async (conversationId) => {
        this.appLogger?.info(`[Sample App] Executing handler for: delete-group-conversation`)
        await this.manager.deleteConversation(conversationId)
      },
      'add-members-to-conversation': async (conversationId, command) => {
        this.appLogger?.info(`[Sample App] Executing handler for: add-members-to-conversation`)

        const parts = command?.trim().split(' ')
        parts?.shift() // remove the command name itself

        if (!parts || parts.length === 0 || parts.length % 2 !== 0) {
          this.appLogger?.info(`[Sample App] Invalid command format. Expected: add-members-to-conversation [USER_ID] [DOMAIN] [USER_ID] [DOMAIN] ...`)
          return
        }

        const members: QualifiedId[] = []
        for (let i = 0; i < parts.length; i += 2) {
          const memberId = parts[i]
          const memberDomain = parts[i + 1]
          if (memberId && memberDomain) {
            members.push(new QualifiedId(memberId, memberDomain))
          }
        }

        const result = await this.manager.addMembersToConversation(conversationId, members)

        // Send feedback about the add operation
        let feedbackMessage = '➕ Member Addition Results:\n\n'

        if (result.membersAdded.length > 0) {
          feedbackMessage += `✅ Successfully added (${result.membersAdded.length}):\n`
          feedbackMessage += result.membersAdded
            .map(m => `  • ${obfuscateId(m.id)}@${m.domain}`)
            .join('\n')
          feedbackMessage += '\n\n'
        }

        if (result.membersFailedToAdd.length > 0) {
          feedbackMessage += `❌ Failed to add (${result.membersFailedToAdd.length}):\n`
          feedbackMessage += result.membersFailedToAdd
            .map(m => `  • ${obfuscateId(m.id)}@${m.domain}`)
            .join('\n')
        }

        if (result.membersAdded.length === 0 && result.membersFailedToAdd.length === 0) {
          feedbackMessage += '⚠️ No members were processed.'
        }

        await this.manager.sendMessage(TextMessage.create({
          conversationId: conversationId,
          text: feedbackMessage
        }))

        this.appLogger?.info(`[Sample App] Addition completed: ${result.membersAdded.length} added, ${result.membersFailedToAdd.length} failed`)
      },
      'remove-members-from-conversation': async (conversationId, command) => {
        this.appLogger?.info(`[Sample App] Executing handler for: remove-members-from-conversation`)

        const parts = command?.trim().split(' ')
        parts?.shift() // remove the command name itself

        if (!parts || parts.length === 0 || parts.length % 2 !== 0) {
          this.appLogger?.info(`[Sample App] Invalid command format. Expected: remove-members-from-conversation [USER_ID] [DOMAIN] [USER_ID] [DOMAIN] ...`)
          return
        }

        const members: QualifiedId[] = []
        for (let i = 0; i < parts.length; i += 2) {
          const memberId = parts[i]
          const memberDomain = parts[i + 1]
          if (memberId && memberDomain) {
            members.push(new QualifiedId(memberId, memberDomain))
          }
        }

        const result = await this.manager.removeMembersFromConversation(conversationId, members)

        // Send feedback about the removal operation
        let feedbackMessage = '📣 Member Removal Results:\n\n'

        if (result.membersRemoved.length > 0) {
          feedbackMessage += `✅ Successfully removed (${result.membersRemoved.length}):\n`
          feedbackMessage += result.membersRemoved
            .map(m => `  • ${obfuscateId(m.id)}@${m.domain}`)
            .join('\n')
        } else {
          feedbackMessage += '⚠️ No members were removed.'
        }

        await this.manager.sendMessage(TextMessage.create({
          conversationId: conversationId,
          text: feedbackMessage
        }))

        this.appLogger?.info(`[Sample App] Removal completed: ${result.membersRemoved.length} removed`)
      },
      'update-member-role': async (conversationId, command) => {
        this.appLogger?.info(`[Sample App] Executing handler for: update-member-role`)

        const parts = command?.trim().split(' ')
        const memberId = parts?.[1]
        const memberDomain = parts?.[2]
        const newRole = parts?.[3] as ConversationRole

        if (!memberId || !memberDomain || !newRole) {
          this.appLogger?.info(`[Sample App] Invalid command format. Expected: update-member-role [USER_ID] [DOMAIN] [ROLE]`)
          return
        }

        const userId: QualifiedId = new QualifiedId(memberId, memberDomain)
        await this.manager.updateConversationMemberRole(conversationId, userId, newRole)
      },
      'get-user-data': async (conversationId, command) => {
        this.appLogger?.info(`[Sample App] Executing handler for: get-user-data`)

        const parts = command?.trim().split(' ')
        const userId = parts?.[1]
        const userDomain = parts?.[2]

        if (!userId || !userDomain) {
          this.appLogger?.info(`[Sample App] Invalid command format. Expected: get-user-data [USER_ID] [DOMAIN]`)
          return
        }

        const userQualifiedId: QualifiedId = new QualifiedId(userId, userDomain)
        const user: WireUser = await this.manager.getUser(userQualifiedId)

        await this.manager.sendMessage(TextMessage.create({
          conversationId: conversationId,
          text: `User data for ${obfuscateId(userQualifiedId.id)}@${userQualifiedId.domain}:
            Name: ${user.name}
            Email: ${user.email ?? 'N/A'}
            Handle: ${user.handle ?? 'N/A'}
            Team: ${user.teamId?.value ?? 'N/A'}
            Deleted: ${user.deleted ?? false}`
        }))
      },
      'get-conversations': async (conversationId) => {
        this.appLogger?.info(`[Sample App] Executing handler for: get-conversations`)

        const conversations = await this.manager.getAllConversations()
        const conversationList = conversations
          .map(c => `- ${c.name ?? 'Unnamed'} (${c.id}@${c.domain})`)
          .join('\n')

        await this.manager.sendMessage(TextMessage.create({
          conversationId: conversationId,
          text: `Conversations (${conversations.length}):\n${conversationList}`
        }))
      },
      'get-conversation-members': async (conversationId, command) => {
        this.appLogger?.info(`[Sample App] Executing handler for: get-conversation-members`)

        const parts = command?.trim().split(' ')
        const targetConversationId = parts?.[1]
        const targetConversationDomain = parts?.[2]

        if (!targetConversationId || !targetConversationDomain) {
          this.appLogger?.info(
            `[Sample App] Invalid command format. Expected: get-conversation-members [CONVERSATION_ID] [DOMAIN]`
          )
          return
        }

        const targetQualifiedId: QualifiedId = new QualifiedId(targetConversationId, targetConversationDomain)
        const members = await this.manager.getMembersInConversation(targetQualifiedId)

        const memberList = members
          .map(m => `- ${obfuscateId(m.userId.id)}@${m.userId.domain} (${m.role})`)
          .join('\n')

        await this.manager.sendMessage(TextMessage.create({
          conversationId: conversationId,
          text: `Members in conversation ${obfuscateId(targetQualifiedId.id)}@${targetQualifiedId.domain} (${members.length}):\n${memberList}`
        }))
      },
      'test-composite-message': async (conversationId, command) => {
        const msg = CompositeMessage.create({
          conversationId: conversationId,
          text: "Composite Title",
          itemList: [
            CompositeButton.create({
              text: "Button-001"
            }),
            CompositeButton.create({
              text: "Button-002"
            })
          ]
        })
  
        await this.manager.sendMessage(msg)
      }
      // More reserved test commands will be added here
    }
  }

  private isReservedTestCommand(message?: string): boolean {
    if (!message) return false
    const cmd = message.trim().split(' ')[0]
    return Object.prototype.hasOwnProperty.call(this.getReservedTestCommandHandlers(), cmd)
  }

  private async processReservedTestCommand(command: string, conversationId: QualifiedId): Promise<boolean> {
    if (!command) return false
    const cmd = command.trim().split(' ')[0]
    const handler = this.getReservedTestCommandHandlers()[cmd]
    if (!handler) return false

    this.appLogger?.info(`[Sample App] Processing reserved test command: ${cmd}`)
    await handler(conversationId, command)
    return true
  }
}

const sampleEventsHandler = new SampleEventsHandler()
sampleEventsHandler.appLogger = new PinoLogger()
const sdk = await WireAppSdk.create(
  userId,
  apiToken,
  userDomain,
  apiHost,
  cryptographyStoragePassword,
  sampleEventsHandler,
  sampleEventsHandler.appLogger
)

sdk.startListening()
