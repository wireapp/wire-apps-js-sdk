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

import fs from 'fs'
import path from 'node:path'
import {
  type Audio,
  CompositeButton,
  CompositeEditedMessage,
  CompositeMessage,
  ConversationRole,
  DeletedMessage,
  type Image,
  Location,
  obfuscateId,
  Ping,
  QualifiedId,
  TextEditedMessage,
  TextMessage,
  type Video,
  WireEventsHandler,
  WireUser
} from '@wireapp/wire-apps-js-sdk'
import {PinoLogger} from './PinoLogger.js'

type Manager = WireEventsHandler['manager']

export class SampleCommandHandler {
  private readonly RESOURCES_PATH = 'resources'

  constructor(
    private readonly manager: Manager,
    private readonly appLogger?: PinoLogger
  ) {
  }

  public isSampleCommand(message?: string): boolean {
    if (!message) return false
    const cmd = message.trim().split(' ')[0]
    return Object.prototype.hasOwnProperty.call(this.getHandlers(), cmd)
  }

  public async process(command: string, conversationId: QualifiedId): Promise<boolean> {
    if (!command) return false
    const cmd = command.trim().split(' ')[0]
    const handler = this.getHandlers()[cmd]
    if (!handler) return false

    this.appLogger?.info(`[Sample App] Processing reserved sample command: ${cmd}`)
    await handler(conversationId, command)
    return true
  }

  private getHandlers(): Record<string, (conversationId: QualifiedId, command?: string) => Promise<void>> {
    return {
      'leave-group-conversation': async (conversationId) => {
        await this.processLeaveGroupConversation(conversationId)
      },
      'delete-group-conversation': async (conversationId) => {
        await this.processDeleteGroupConversation(conversationId)
      },
      'add-members-to-conversation': async (conversationId, command) => {
        await this.processAddMembersToConversation(conversationId, command)
      },
      'remove-members-from-conversation': async (conversationId, command) => {
        await this.processRemoveMembersFromConversation(conversationId, command)
      },
      'update-member-role': async (conversationId, command) => {
        await this.processUpdateMemberRole(conversationId, command)
      },
      'get-user-data': async (conversationId, command) => {
        await this.processGetUserData(conversationId, command)
      },
      'get-conversations': async (conversationId) => {
        await this.processGetConversations(conversationId)
      },
      'get-conversation-members': async (conversationId, command) => {
        await this.processGetConversationMembers(conversationId, command)
      },
      'create-group-conversation': async (conversationId, command) => {
        await this.processCreateGroupConversation(command ?? "")
      },
      'create-channel-conversation': async (conversationId, command) => {
        await this.processCreateChannelConversation(command ?? "")
      },
      'create-onetoone-conversation': async (conversationId, command) => {
        await this.processCreateOneToOneConversation(command ?? "")
      },
      'test-deleted-message': async (conversationId) => {
        await this.processTestDeletedMessage(conversationId)
      },
      'search-user': async (conversationId, command) => {
        await this.processSearchUser(conversationId, command)
      },
      'test-edit-text': async (conversationId) => {
        await this.processTestEditText(conversationId)
      },
      'test-edit-composite': async (conversationId) => {
        await this.processTestEditComposite(conversationId)
      },
      'send-asset-image': async (conversationId) => {
        this.sendAssetImage(conversationId)
      },
      'send-asset-audio': async (conversationId) => {
        this.sendAssetAudio(conversationId)
      },
      'send-asset-video': async (conversationId) => {
        this.sendAssetVideo(conversationId)
      },
      'send-ephemeral-text': async (conversationId) => {
        await this.sendEphemeralText(conversationId)
      },
      'send-ephemeral-image': async (conversationId) => {
        await this.sendEphemeralImage(conversationId)
      },
      'send-ephemeral-location': async (conversationId) => {
        await this.sendEphemeralLocation(conversationId)
      },
      'send-ephemeral-ping': async (conversationId) => {
        await this.sendEphemeralPing(conversationId)
      },
      'send-composite-message': async (conversationId) => {
        await this.sendCompositeMessage(conversationId)
      },
      'send-location-message': async (conversationId) => {
        await this.sendLocationMessage(conversationId)
      },
      'send-ephemeral-location-message': async (conversationId) => {
        await this.sendEphemeralLocationMessage(conversationId)
      }
    }
  }

  private async processLeaveGroupConversation(conversationId: QualifiedId): Promise<void> {
    this.appLogger?.info(`[Sample App] Executing handler for: leave-group-conversation`)
    await this.manager.leaveConversation(conversationId)
  }

  private async processDeleteGroupConversation(conversationId: QualifiedId): Promise<void> {
    this.appLogger?.info(`[Sample App] Executing handler for: delete-group-conversation`)
    await this.manager.deleteConversation(conversationId)
  }

  private async processAddMembersToConversation(conversationId: QualifiedId, command?: string): Promise<void> {
    this.appLogger?.info(`[Sample App] Executing handler for: add-members-to-conversation`)

    const parts = command?.trim().split(' ')
    parts?.shift() // remove the command name itself

    if (!parts || parts.length === 0 || parts.length % 2 !== 0) {
      this.appLogger?.info(
        `[Sample App] Invalid command format. Expected: add-members-to-conversation [USER_ID] [DOMAIN] [USER_ID] [DOMAIN] ...`
      )
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

    this.appLogger?.info(
      `[Sample App] Addition completed: ${result.membersAdded.length} added, ${result.membersFailedToAdd.length} failed`
    )
  }

  private async processRemoveMembersFromConversation(conversationId: QualifiedId, command?: string): Promise<void> {
    this.appLogger?.info(`[Sample App] Executing handler for: remove-members-from-conversation`)

    const parts = command?.trim().split(' ')
    parts?.shift() // remove the command name itself

    if (!parts || parts.length === 0 || parts.length % 2 !== 0) {
      this.appLogger?.info(
        `[Sample App] Invalid command format. Expected: remove-members-from-conversation [USER_ID] [DOMAIN] [USER_ID] [DOMAIN] ...`
      )
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

    this.appLogger?.info(
      `[Sample App] Removal completed: ${result.membersRemoved.length} removed`
    )
  }

  private async processUpdateMemberRole(conversationId: QualifiedId, command?: string): Promise<void> {
    this.appLogger?.info(`[Sample App] Executing handler for: update-member-role`)

    const parts = command?.trim().split(' ')
    const memberId = parts?.[1]
    const memberDomain = parts?.[2]
    const newRole = parts?.[3] as ConversationRole

    if (!memberId || !memberDomain || !newRole) {
      this.appLogger?.info(
        `[Sample App] Invalid command format. Expected: update-member-role [USER_ID] [DOMAIN] [ROLE]`
      )
      return
    }

    const userId: QualifiedId = new QualifiedId(memberId, memberDomain)
    await this.manager.updateConversationMemberRole(conversationId, userId, newRole)
  }

  private async processGetUserData(conversationId: QualifiedId, command?: string): Promise<void> {
    this.appLogger?.info(`[Sample App] Executing handler for: get-user-data`)

    const parts = command?.trim().split(' ')
    const userId = parts?.[1]
    const userDomain = parts?.[2]

    if (!userId || !userDomain) {
      this.appLogger?.info(
        `[Sample App] Invalid command format. Expected: get-user-data [USER_ID] [DOMAIN]`
      )
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
  }

  private async processGetConversations(conversationId: QualifiedId): Promise<void> {
    this.appLogger?.info(`[Sample App] Executing handler for: get-conversations`)

    const conversations = await this.manager.getAllConversations()
    const conversationList = conversations
      .map(c => `- ${c.name ?? 'Unnamed'} (${c.id}@${c.domain})`)
      .join('\n')

    await this.manager.sendMessage(TextMessage.create({
      conversationId: conversationId,
      text: `Conversations (${conversations.length}):\n${conversationList}`
    }))
  }

  private async processGetConversationMembers(conversationId: QualifiedId, command?: string): Promise<void> {
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

    const targetQualifiedId: QualifiedId = new QualifiedId(
      targetConversationId,
      targetConversationDomain
    )
    const members = await this.manager.getMembersInConversation(targetQualifiedId)

    const memberList = members
      .map(m => `- ${obfuscateId(m.userId.id)}@${m.userId.domain} (${m.role})`)
      .join('\n')

    await this.manager.sendMessage(TextMessage.create({
      conversationId: conversationId,
      text: `Members in conversation ${obfuscateId(targetQualifiedId.id)}@${targetQualifiedId.domain} (${members.length}):\n${memberList}`
    }))
  }

  private async processCreateGroupConversation(command: string): Promise<void> {
    const args = command.trim().split(/\s+/)
    const name = args[1]
    const userArgs = args.slice(2)

    if (!name || userArgs.length === 0 || userArgs.length % 2 !== 0) {
      this.appLogger?.info(
        `[Sample App] Invalid command format. Expected: create-group-conversation [NAME] [USER_ID] [DOMAIN]...`
      )
      return
    }

    const participants: QualifiedId[] = []

    for (let i = 0; i < userArgs.length; i += 2) {
      const userId = userArgs[i]
      const domain = userArgs[i + 1]
      participants.push(new QualifiedId(userId, domain))
    }

    await this.manager.createGroupConversation(name, participants)
  }

  private async processCreateChannelConversation(command: string): Promise<void> {
    const args = command.trim().split(/\s+/)
    const name = args[1]
    const userArgs = args.slice(2)

    if (!name || userArgs.length === 0 || userArgs.length % 2 !== 0) {
      this.appLogger?.info(
        `[Sample App] Invalid command format. Expected: create-channel-conversation [NAME] [USER_ID] [DOMAIN]...`
      )
      return
    }

    const participants: QualifiedId[] = []

    for (let i = 0; i < userArgs.length; i += 2) {
      const userId = userArgs[i]
      const domain = userArgs[i + 1]
      participants.push(new QualifiedId(userId, domain))
    }

    await this.manager.createChannelConversation(name, participants)
  }

  private async processCreateOneToOneConversation(command: string): Promise<void> {
    const args = command.trim().split(/\s+/)

    const userId = args[1]
    const domain = args[2]

    if (!userId || !domain || args.length !== 3) {
      this.appLogger?.info(
        "[Sample App] Invalid command format. Expected: create-onetoone-conversation [USER_ID] [DOMAIN]"
      )
      return
    }

    await this.manager.createOneToOneConversation(new QualifiedId(userId, domain))
  }

  private async processTestDeletedMessage(conversationId: QualifiedId): Promise<void> {
    this.appLogger?.info(
      `[Sample App] Sending a text message and then deleting it after 3 seconds`
    )

    const message = TextMessage.create({
      conversationId: conversationId,
      text: "This message will be deleted in 3 seconds"
    })

    await this.manager.sendMessage(message)

    await new Promise(resolve => setTimeout(resolve, 3000))

    const deleted = DeletedMessage.create({
      conversationId: conversationId,
      messageId: message.id
    })

    await this.manager.sendMessage(deleted)
  }

  private async processSearchUser(conversationId: QualifiedId, command?: string): Promise<void> {
    this.appLogger?.info(`[Sample App] Executing handler for: search-user`)

    const parts = command?.trim().split(' ')
    const query = parts?.[1]
    const domain = parts?.[2]
    const numberOfResults = parts?.[3] ? parseInt(parts[3], 10) : undefined

    if (!query || !domain) {
      this.appLogger?.info(
        `[Sample App] Invalid command format. Expected: search-user [QUERY] [DOMAIN] [NUMBER_OF_RESULTS?]`
      )
      return
    }

    const users: WireUser[] = await this.manager.searchUsers(
      query,
      domain,
      numberOfResults
    )

    const userList = users.length > 0
      ? users
        .map(u => `- ${u.name} | Handle: ${u.handle ?? 'N/A'} | Team: ${u.teamId?.value ?? 'N/A'}`)
        .join('\n')
      : 'No users found.'

    await this.manager.sendMessage(TextMessage.create({
      conversationId: conversationId,
      text: `Search results for "${query}" on ${domain} (${users.length}):\n${userList}`
    }))
  }

  private async processTestEditText(conversationId: QualifiedId): Promise<void> {
    this.appLogger?.info(`[Sample App] Sending a Text Edit message`)

    const message = TextMessage.create({
      conversationId: conversationId,
      text: "This message will be edited in 3 seconds"
    })

    await this.manager.sendMessage(message)

    await new Promise(resolve => setTimeout(resolve, 3000))

    const messageEdit = TextEditedMessage.create({
      conversationId: conversationId,
      replacingMessageId: message.id,
      text: "This message got edited"
    })

    await this.manager.sendMessage(messageEdit)
  }

  private async processTestEditComposite(conversationId: QualifiedId): Promise<void> {
    const mutableItemList = [
      TextMessage.create({
        conversationId: conversationId,
        text: "Text item that will be removed in 9 seconds"
      }),
      CompositeButton.create({
        text: "Button item that will be removed in 6 seconds"
      }),
      CompositeButton.create({
        text: "Button item that will be removed in 3 seconds"
      })
    ]

    let latestMessageID = await this.manager.sendMessage(
      CompositeMessage.create({
        conversationId: conversationId,
        itemList: mutableItemList
      })
    )

    while (mutableItemList.length != 0) {
      await new Promise(resolve => setTimeout(resolve, 3000))
      mutableItemList.pop()

      const compositeEdit = CompositeEditedMessage.create({
        conversationId: conversationId,
        itemList: mutableItemList,
        replacingMessageId: latestMessageID
      })

      latestMessageID = await this.manager.sendMessage(compositeEdit)
    }
  }

  private sendAssetImage(conversationId: QualifiedId) {
    const filename = 'banana-icon.png'
    const filePath = path.join(this.RESOURCES_PATH, filename)

    fs.readFile(filePath, (err, data) => {
      if (err) {
        throw err
      }

      const metadata: Image = {
        type: 'image',
        width: 240,
        height: 240
      }

      this.manager.sendAsset(
        conversationId,
        {
          data: data,
          name: filename,
          mimeType: "image/png",
          metadata: metadata
        }
      )
    })
  }

  private sendAssetAudio(conversationId: QualifiedId) {
    const filename = 'sample_audio_6s.mp3'
    const filePath = path.join(this.RESOURCES_PATH, filename)

    fs.readFile(filePath, (err, data) => {
      if (err) {
        throw err
      }

      const metadata: Audio = this.getSampleAudioMetadata()

      this.manager.sendAsset(
        conversationId,
        {
          data: data,
          name: filename,
          mimeType: "audio/mp3",
          metadata: metadata
        }
      )
    })
  }

  private sendAssetVideo(conversationId: QualifiedId) {
    const filename = 'sample_video_5s.mp4'
    const filePath = path.join(this.RESOURCES_PATH, filename)

    fs.readFile(filePath, (err, data) => {
      if (err) {
        throw err
      }

      const metadata: Video = {
        type: 'video',
        width: 1920,
        height: 1080,
        durationMs: 5000
      }

      this.manager.sendAsset(
        conversationId,
        {
          data: data,
          name: filename,
          mimeType: "video/mp4",
          metadata: metadata
        }
      )
    })
  }

  private async sendEphemeralText(conversationId: QualifiedId): Promise<void> {
    this.appLogger?.info(`[Sample App] Sending an Ephemeral Text message`)

    const message = TextMessage.create({
      conversationId: conversationId,
      text: "This is an Ephemeral Text message",
      expiresAfterMillis: 10000
    })

    await this.manager.sendMessage(message)
  }

  private async sendEphemeralImage(conversationId: QualifiedId): Promise<void> {
    this.appLogger?.info(`[Sample App] Sending an Ephemeral Asset message`)

    const filename = 'banana-icon.png'
    const filePath = path.join(this.RESOURCES_PATH, filename)

    fs.readFile(filePath, (err, data) => {
      if (err) {
        throw err
      }

      const metadata: Image = {
        type: 'image',
        width: 240,
        height: 240
      }

      this.manager.sendAsset(
        conversationId,
        {
          data: data,
          name: filename,
          mimeType: "image/png",
          metadata: metadata
        },
        10000
      )
    })
  }

  private async sendEphemeralLocation(conversationId: QualifiedId): Promise<void> {
    this.appLogger?.info(`[Sample App] Sending an Ephemeral Location message`)

    const message = Location.create({
      conversationId: conversationId,
      latitude: 52.5251,
      longitude: 13.3694,
      name: "Berlin Hauptbahnhof, Hauptbahnhof, Europaplatz 1, 10557 Berlin",
      zoom: 11,
      expiresAfterMillis: 10000
    })

    await this.manager.sendMessage(message)
  }

  private async sendEphemeralPing(conversationId: QualifiedId): Promise<void> {
    this.appLogger?.info(`[Sample App] Sending an Ephemeral Ping message`)

    const message = Ping.create({
      conversationId: conversationId,
      expiresAfterMillis: 10000
    })

    await this.manager.sendMessage(message)
  }

  private async sendCompositeMessage(conversationId: QualifiedId): Promise<void> {
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

  private async sendLocationMessage(conversationId: QualifiedId): Promise<void> {
    const msg = Location.create({
      conversationId: conversationId,
      latitude: 52.52527,
      longitude: 13.36923,
      name: "Berlin Hauptbahnhof, 10557 Berlin",
      zoom: 50
    })

    await this.manager.sendMessage(msg)
  }

  private async sendEphemeralLocationMessage(conversationId: QualifiedId): Promise<void> {
    const msg = Location.create({
      conversationId: conversationId,
      latitude: 52.51615,
      longitude: 13.37827,
      name: "Pariser Platz, 10117 Berlin",
      zoom: 50,
      expiresAfterMillis: 5000
    })

    await this.manager.sendMessage(msg)
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
}
