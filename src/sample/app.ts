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
import {TextMessage, WireAppSdk, WireEventsHandler} from '../index.js'
import type {QualifiedId} from "../model/QualifiedId.js"; // This will be imported from the SDK when used outside of this repository

dotenv.config()

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
  public override async onTextMessageReceived(wireMessage: TextMessage): Promise<void> {
    console.log(`[SampleEventsHandler] Received message: ${wireMessage.text}`)
    const textMessage = TextMessage.create({
      conversationId: wireMessage.conversationId,
      text: `Sent from SampleEventsHandler: ${wireMessage.text}`
    })

    this.manager.sendMessage(textMessage)
  }

  public override async onConversationDeleted(conversationId: QualifiedId): Promise<void> {
    console.log(`[Sample App] A conversation was deleted: ${conversationId.id}@${conversationId.domain}`)
  }

  // TODO: Baris: Implement other callbacks as well
}

const sampleEventsHandler = new SampleEventsHandler()
const sdk = await WireAppSdk.create(
  userEmail,
  userPassword,
  userId,
  userDomain,
  apiHost,
  cryptographyStoragePassword,
  sampleEventsHandler,
  new PinoLogger()
)

sdk.startListening()
