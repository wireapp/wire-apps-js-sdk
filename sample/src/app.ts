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
  obfuscateId,
  type QualifiedId,
  TextMessage,
  AssetMessage,
  type Audio,
  type Image,
  type Video,
  WireAppSdk,
  WireEventsHandler
} from 'wire-apps-js-sdk'
import fs from 'fs'

dotenv.config({ path: '../.env' })

const userEmail = process.env['WIRE_SDK_USER_EMAIL'];
const userPassword = process.env['WIRE_SDK_USER_PASSWORD'];
const userId = process.env['WIRE_SDK_USER_ID'];
const userDomain = process.env['WIRE_SDK_USER_DOMAIN'];
const apiHost = process.env['WIRE_SDK_API_HOST'];
const cryptographyStoragePassword = process.env['WIRE_SDK_CRYPTO_PASSWORD'];

if (!userEmail) {
  throw new Error('WIRE_SDK_USER_EMAIL must be set in .env file');
}

if (!userPassword) {
  throw new Error('WIRE_SDK_USER_PASSWORD must be set in .env file');
}

if (!userId) {
  throw new Error('WIRE_SDK_USER_ID must be set in .env file');
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

  public override async onTextMessageReceived(wireMessage: TextMessage): Promise<void> {
    this.appLogger?.info(`[SampleEventsHandler] Received message: ${wireMessage.text}`)
    if (wireMessage.text == "asset-image") {
      this.processAssetImage(wireMessage);
    } else if (wireMessage.text == "asset-audio") {
      this.processAssetAudio(wireMessage);
    } else if (wireMessage.text == "asset-video") {
      this.processAssetVideo(wireMessage);
    } else {
      const textMessage = TextMessage.create({
        conversationId: wireMessage.conversationId,
        text: `Sent from SampleEventsHandler: ${wireMessage.text}`
      })

      this.manager.sendMessage(textMessage)
    }
  }

  public override async onConversationDeleted(conversationId: QualifiedId): Promise<void> {
    this.appLogger?.info(`[Sample App] A conversation was deleted: ${conversationId.id}@${conversationId.domain}`)
  }

  public override async onAppAddedToConversation(conversation: Conversation, members: ConversationMember[]): Promise<void> {
    this.appLogger?.info(`[Sample App] App was added to conversation: ${obfuscateId(conversation.id)} with ${members.length} members`)
    const textMessage = TextMessage.create({
      conversationId: { id: conversation.id, domain: conversation.domain },
      text: `Hello! I'm the Sample App 🙂 I've just joined this conversation 👋`
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

  private processAssetImage(wireMessage: TextMessage) {
    const filename = 'banana-icon.png'
    const path = `./resources/${filename}`
    fs.readFile(path, (err, data) => {
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
    const path = `./src/sample/resources/${filename}`
    fs.readFile(path, (err, data) => {
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
    const path = `./src/sample/resources/${filename}`
    fs.readFile(path, (err, data) => {
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
}

const sampleEventsHandler = new SampleEventsHandler()
sampleEventsHandler.appLogger = new PinoLogger()
const sdk = await WireAppSdk.create(
  userEmail,
  userPassword,
  userId,
  userDomain,
  apiHost,
  cryptographyStoragePassword,
  sampleEventsHandler,
  sampleEventsHandler.appLogger
)

sdk.startListening()
