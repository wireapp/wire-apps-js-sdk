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
import {PinoLogger} from './PinoLogger.js'
import {
  AssetMessage,
  type BackendConnectionListener,
  type Conversation,
  type ConversationMember,
  Location,
  obfuscateId,
  Ping,
  QualifiedId,
  Reaction,
  Receipt,
  ReceiptType,
  TextEditedMessage,
  TextMessage,
  WireAppSdk,
  WireEventsHandler
} from '@wireapp/wire-apps-js-sdk'
import fs from 'fs'
import {SampleCommandHandler} from "./SampleCommandHandler.js";

dotenv.config({path: '../.env'})

const userId = process.env['WIRE_SDK_USER_ID'];
const apiToken = process.env['WIRE_SDK_API_TOKEN'];
const userDomain = process.env['WIRE_SDK_USER_DOMAIN'];
const apiHost = process.env['WIRE_SDK_API_HOST'];

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

class SampleEventsHandler extends WireEventsHandler {
  public appLogger?: PinoLogger
  private _sampleCommandHandler?: SampleCommandHandler

  private get sampleCommandHandler(): SampleCommandHandler {
    if (!this._sampleCommandHandler) {
      this._sampleCommandHandler = new SampleCommandHandler(this.manager, this.appLogger)
    }
    return this._sampleCommandHandler
  }

  public override async onTextMessageReceived(wireMessage: TextMessage): Promise<void> {
    this.appLogger?.info(`[Sample App] Received message: ${wireMessage.text}`)
    if (this.sampleCommandHandler.isSampleCommand(wireMessage.text)) {
      await this.sampleCommandHandler.process(wireMessage.text, wireMessage.conversationId)
    } else {
      await this.processSimpleTextMessage(wireMessage);
    }
  }

  public override async onTextEditedMessageReceived(wireMessage: TextEditedMessage): Promise<void> {
    this.appLogger?.info(`[Sample App] Received a Text Edit, notifying conversation that it happen`)

    const textMessage = TextMessage.create({
      conversationId: wireMessage.conversationId,
      text: `Message with ID: ${wireMessage.replacingMessageId}, got edited. Now it's ID is: ${wireMessage.id}`
    })

    await this.manager.sendMessage(textMessage)
  }

  public override async onPingReceived(wireMessage: Ping): Promise<void> {
    this.appLogger?.info(`[Sample App] Received a Ping, sending one back`)

    const ping = Ping.create({
      conversationId: wireMessage.conversationId
    })

    await this.manager.sendMessage(ping)
  }

  public override async onLocationReceived(wireMessage: Location): Promise<void> {
    this.appLogger?.info(`[Sample App] Received a Location, sending back the details`)

    let locationDetails = `Received Location:`
    locationDetails += `\nLatitude: ${wireMessage.latitude}`
    locationDetails += `\nLongitude: ${wireMessage.longitude}`
    locationDetails += `\nName: ${wireMessage.name}`
    locationDetails += `\nzoom: ${wireMessage.zoom}`

    // Sending a Read Receipt for the received message
    const receipt = Receipt.create({
      conversationId: wireMessage.conversationId,
      receiptType: ReceiptType.READ,
      messageIds: [wireMessage.id]
    })

    await this.manager.sendMessage(receipt)

    // Sending a reply message for the received location type message
    const replyMessage = TextMessage.createReply({
      originalMessage: wireMessage,
      text: locationDetails
    })

    await this.manager.sendMessage(replyMessage)
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

    // Download the asset
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

    // Reply the asset message
    const replyMessage = TextMessage.createReply({
      originalMessage: wireMessage,
      text: `😍Very nice!`,
    })
    await this.manager.sendMessage(replyMessage)
  }

  private async processSimpleTextMessage(wireMessage: TextMessage) {
    const replyMessage = TextMessage.createReply({
      originalMessage: wireMessage,
      text: `${wireMessage.text} -- Sent from the TS Sample SDK`,
      linkPreviews: wireMessage.linkPreviews,
      mentions: wireMessage.mentions
    })

    await this.manager.sendMessage(replyMessage)

    // Sending a Read Receipt for the received message
    const receipt = Receipt.create({
      conversationId: wireMessage.conversationId,
      receiptType: ReceiptType.READ,
      messageIds: [wireMessage.id]
    })

    await this.manager.sendMessage(receipt)

    // Add emojis on the received text message
    const reaction = Reaction.create({
      conversationId: wireMessage.conversationId,
      messageId: wireMessage.id,
      emojiSet: new Set<string>(["🧩", "T", "S", "🚀"])
    })

    await this.manager.sendMessage(reaction)
  }
}

const sampleEventsHandler = new SampleEventsHandler()
sampleEventsHandler.appLogger = new PinoLogger()
const cryptographyStorageKey = new Uint8Array(32).fill(1)

const sdk = await WireAppSdk.create(
  userId,
  apiToken,
  userDomain,
  apiHost,
  cryptographyStorageKey,
  sampleEventsHandler,
  sampleEventsHandler.appLogger
)

const backendConnectionListener: BackendConnectionListener = {
  onConnected: () => sampleEventsHandler.appLogger?.info('[Sample App] Connected to Wire backend 😍'),
  onDisconnected: () => sampleEventsHandler.appLogger?.info('[Sample App] Disconnected from Wire backend 😭'),
}

sdk.setBackendConnectionListener(backendConnectionListener)
sdk.startListening()
