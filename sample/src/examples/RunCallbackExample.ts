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

/* eslint-disable no-undef */

import 'reflect-metadata'
import {type BackendConnectionListener, WireAppSdk, type WireEventsHandler} from '@wireapp/wire-apps-js-sdk'
import {CRYPTOGRAPHY_STORAGE_KEY, WIRE_API_HOST, WIRE_API_TOKEN} from './ExampleConfig.js'
import {exampleLogger} from './ExampleLogger.js'
import {CreateOneToOneConversationWithNewJoinerExample} from './callbacks/CreateOneToOneConversationWithNewJoinerExample.js'
import {DownloadOnAssetReceivedExample} from './callbacks/DownloadOnAssetReceivedExample.js'
import {GreetConversationOnAppAddedExample} from './callbacks/GreetConversationOnAppAddedExample.js'
import {GreetNewJoinerInConversationExample} from './callbacks/GreetNewJoinerInConversationExample.js'
import {ReadAndReactOnTextMsgReceivedExample} from './callbacks/ReadAndReactOnTextMsgReceivedExample.js'
import {ReplyMessageExample} from './callbacks/ReplyMessageExample.js'
import {SendEphemeralMessageExample} from './callbacks/SendEphemeralMessageExample.js'
import {SendPingExample} from './callbacks/SendPingExample.js'
import {SendWireLocationInfoExample} from './callbacks/SendWireLocationInfoExample.js'

/**
 * Runner for the callback examples. It starts the SDK with the events handler of the
 * example that is passed as the first command line argument.
 *
 * Usage: npm run -w sample example:callback -- <ExampleName>
 */
const CALLBACK_EXAMPLES: Record<string, () => WireEventsHandler> = {
  CreateOneToOneConversationWithNewJoinerExample: () => new CreateOneToOneConversationWithNewJoinerExample(),
  DownloadOnAssetReceivedExample: () => new DownloadOnAssetReceivedExample(),
  GreetConversationOnAppAddedExample: () => new GreetConversationOnAppAddedExample(),
  GreetNewJoinerInConversationExample: () => new GreetNewJoinerInConversationExample(),
  ReadAndReactOnTextMsgReceivedExample: () => new ReadAndReactOnTextMsgReceivedExample(),
  ReplyMessageExample: () => new ReplyMessageExample(),
  SendEphemeralMessageExample: () => new SendEphemeralMessageExample(),
  SendPingExample: () => new SendPingExample(),
  SendWireLocationInfoExample: () => new SendWireLocationInfoExample()
}

const exampleName = process.argv[2]
const createEventsHandler = exampleName ? CALLBACK_EXAMPLES[exampleName] : undefined

if (!createEventsHandler) {
  const availableExamples = Object.keys(CALLBACK_EXAMPLES)
    .map((name) => `  - ${name}`)
    .join('\n')

  console.error(
    `Unknown or missing callback example: ${exampleName ?? '(none given)'}\n\n` +
      `Available callback examples:\n${availableExamples}\n\n` +
      `Usage: npm run -w sample example:callback -- <ExampleName>`
  )
  process.exit(1)
}

const sdk = await WireAppSdk.create(
  WIRE_API_TOKEN,
  WIRE_API_HOST,
  CRYPTOGRAPHY_STORAGE_KEY,
  createEventsHandler(),
  exampleLogger
)

const backendConnectionListener: BackendConnectionListener = {
  onConnected: () => exampleLogger.info(`[${exampleName}] Connected to Wire backend 😍`),
  onDisconnected: () => exampleLogger.info(`[${exampleName}] Disconnected from Wire backend 😭`)
}

sdk.setBackendConnectionListener(backendConnectionListener)

exampleLogger.info(`[${exampleName}] Example is running. Press Ctrl+C to stop.`)
await sdk.startListening()
