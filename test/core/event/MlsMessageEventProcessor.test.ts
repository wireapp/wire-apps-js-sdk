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

import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {NewMLSMessageDTO} from '../../../src/model/EventContentDTO.js'
import {ConversationService} from '../../../src/api/ConversationService.js'
import {MlsMessageEventProcessor} from '../../../src/core/event/MlsMessageEventProcessor.js'
import type {WireEventsHandler} from '../../../src/core/WireEventsHandler.js'
import {CoreCryptoService} from '../../../src/core/CoreCryptoService.js'
import {MlsFallbackStrategy} from '../../../src/service/MlsFallbackStrategy.js'
import {ProtobufDeserializer} from '../../../src/mappers/protobuf/ProtobufDeserializer.js'
import {QualifiedId} from '../../../src/model/QualifiedId.js'

const loggerMock = vi.hoisted(() => ({debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()}))

vi.mock('../../../src/api/ConversationService.js')
vi.mock('../../../src/core/CoreCryptoService.js')
vi.mock('../../../src/service/MlsFallbackStrategy.js')
vi.mock('../../../src/mappers/protobuf/ProtobufDeserializer.js')
vi.mock('../../../src/utils/logger/LoggerFactory.js', () => ({
  LoggerFactory: {
    getLogger: vi.fn(() => loggerMock)
  }
}))

const qualifiedConversation = new QualifiedId('conv-123', 'example.com')
const mlsGroupId = 'mls-group-id'
const decryptedPlaintext = new Uint8Array([1, 2, 3])
const decryptedSender = new QualifiedId('decrypted-sender', 'example.com')
const decryptedMessage = {plaintext: decryptedPlaintext, sender: decryptedSender}
const qualifiedFrom = {id: 'decrypted-sender', domain: 'example.com'}
const eventDate = new Date()

const makeEvent = (from = qualifiedFrom): NewMLSMessageDTO => ({
  type: 'conversation.mls-message-add',
  time: eventDate,
  data: 'base64encodeddata',
  qualified_conversation: qualifiedConversation,
  qualified_from: from
})

const makeTextMessage = () => ({type: 'text' as const, text: 'hello'}) as any
const makeAssetMessage = () => ({type: 'asset' as const, mimeType: 'image/png', sizeInBytes: 1024}) as any
const makePing = () => ({type: 'ping' as const, id: 'ping-id'}) as any
const makeLocationMessage = () => ({type: 'location' as const, id: 'location-id'}) as any
const makeDeletedMessage = () => ({type: 'deleted' as const, id: 'message-id', messageId: 'deleted-message-id'}) as any
const makeReceipt = () => ({type: 'receipt' as const, id: 'message-id', messageIds: ['delivered-message-id']}) as any
const makeReaction = () =>
  ({type: 'reaction' as const, id: 'reaction-message-id', messageId: 'target-message-id'}) as any
const makeUnknownMessage = () => ({type: 'unknown' as const}) as any

let conversationService: ConversationService
let coreCryptoService: CoreCryptoService
let mlsFallbackStrategy: MlsFallbackStrategy
let wireEventsHandler: WireEventsHandler
let processor: MlsMessageEventProcessor

beforeEach(() => {
  vi.clearAllMocks()

  conversationService = {
    getConversationMLSGroupId: vi.fn().mockResolvedValue(mlsGroupId)
  } as any

  coreCryptoService = {
    decryptMlsMessage: vi.fn().mockResolvedValue(decryptedMessage)
  } as any

  mlsFallbackStrategy = {
    verifyConversationOutOfSync: vi.fn().mockResolvedValue(undefined)
  } as any

  wireEventsHandler = {
    onTextMessageReceived: vi.fn().mockResolvedValue(undefined),
    onAssetMessageReceived: vi.fn().mockResolvedValue(undefined),
    onPingReceived: vi.fn().mockResolvedValue(undefined),
    onLocationMessageReceived: vi.fn().mockResolvedValue(undefined),
    onMessageDeleted: vi.fn().mockResolvedValue(undefined),
    onMessageDelivered: vi.fn().mockResolvedValue(undefined),
    onMessageReactionReceived: vi.fn().mockResolvedValue(undefined)
  } as any

  processor = new MlsMessageEventProcessor(
    coreCryptoService,
    conversationService,
    mlsFallbackStrategy,
    wireEventsHandler
  )
})

describe('MlsMessageEventProcessor', () => {
  describe('process', () => {
    it('should fetch the MLS group id using the qualified conversation', async () => {
      vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(makeTextMessage())

      await processor.process(makeEvent())

      expect(conversationService.getConversationMLSGroupId).toHaveBeenCalledTimes(1)
      expect(conversationService.getConversationMLSGroupId).toHaveBeenCalledWith(qualifiedConversation)
    })

    it('should decrypt the MLS message using the group id and event data', async () => {
      vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(makeTextMessage())
      const event = makeEvent()

      await processor.process(event)

      expect(coreCryptoService.decryptMlsMessage).toHaveBeenCalledTimes(1)
      expect(coreCryptoService.decryptMlsMessage).toHaveBeenCalledWith(mlsGroupId, event.data)
    })

    it('should return early without forwarding if decryption returns null', async () => {
      vi.mocked(coreCryptoService.decryptMlsMessage).mockResolvedValue(undefined)

      await processor.process(makeEvent())

      expect(ProtobufDeserializer.toWireMessage).not.toHaveBeenCalled()
      expect(wireEventsHandler.onTextMessageReceived).not.toHaveBeenCalled()
      expect(wireEventsHandler.onAssetMessageReceived).not.toHaveBeenCalled()
    })

    describe('forwardMessage', () => {
      it('should call onTextMessageReceived for text messages', async () => {
        const textMessage = makeTextMessage()
        vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(textMessage)

        await processor.process(makeEvent())

        expect(wireEventsHandler.onTextMessageReceived).toHaveBeenCalledTimes(1)
        expect(wireEventsHandler.onTextMessageReceived).toHaveBeenCalledWith(textMessage)
        expect(wireEventsHandler.onAssetMessageReceived).not.toHaveBeenCalled()
      })

      it('should call onAssetMessageReceived for asset messages', async () => {
        const assetMessage = makeAssetMessage()
        vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(assetMessage)

        await processor.process(makeEvent())

        expect(wireEventsHandler.onAssetMessageReceived).toHaveBeenCalledTimes(1)
        expect(wireEventsHandler.onAssetMessageReceived).toHaveBeenCalledWith(assetMessage)
        expect(wireEventsHandler.onTextMessageReceived).not.toHaveBeenCalled()
      })

      it('should call onPingReceived for ping messages', async () => {
        const ping = makePing()
        vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(ping)

        await processor.process(makeEvent())

        expect(wireEventsHandler.onPingReceived).toHaveBeenCalledTimes(1)
        expect(wireEventsHandler.onPingReceived).toHaveBeenCalledWith(ping)
        expect(wireEventsHandler.onTextMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onAssetMessageReceived).not.toHaveBeenCalled()
      })

      it('should call onLocationMessageReceived for location messages', async () => {
        const locationMessage = makeLocationMessage()
        vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(locationMessage)

        await processor.process(makeEvent())

        expect(wireEventsHandler.onLocationMessageReceived).toHaveBeenCalledTimes(1)
        expect(wireEventsHandler.onLocationMessageReceived).toHaveBeenCalledWith(locationMessage)
        expect(wireEventsHandler.onTextMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onAssetMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onPingReceived).not.toHaveBeenCalled()
      })

      it('should call onMessageDeleted for deleted messages', async () => {
        const deletedMessage = makeDeletedMessage()
        vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(deletedMessage)

        await processor.process(makeEvent())

        expect(wireEventsHandler.onMessageDeleted).toHaveBeenCalledTimes(1)
        expect(wireEventsHandler.onMessageDeleted).toHaveBeenCalledWith(deletedMessage)
        expect(wireEventsHandler.onTextMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onAssetMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onPingReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onLocationMessageReceived).not.toHaveBeenCalled()
      })

      it('should call onMessageDelivered for receipt messages', async () => {
        const receipt = makeReceipt()
        vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(receipt)

        await processor.process(makeEvent())

        expect(wireEventsHandler.onMessageDelivered).toHaveBeenCalledTimes(1)
        expect(wireEventsHandler.onMessageDelivered).toHaveBeenCalledWith(receipt)
        expect(wireEventsHandler.onTextMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onAssetMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onPingReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onLocationMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onMessageDeleted).not.toHaveBeenCalled()
      })

      it('should call onMessageReactionReceived for reaction messages', async () => {
        const reaction = makeReaction()
        vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(reaction)

        await processor.process(makeEvent())

        expect(wireEventsHandler.onMessageReactionReceived).toHaveBeenCalledTimes(1)
        expect(wireEventsHandler.onMessageReactionReceived).toHaveBeenCalledWith(reaction)
        expect(wireEventsHandler.onTextMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onAssetMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onPingReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onLocationMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onMessageDeleted).not.toHaveBeenCalled()
        expect(wireEventsHandler.onMessageDelivered).not.toHaveBeenCalled()
      })

      it('should not forward unknown message types', async () => {
        vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(makeUnknownMessage())

        await processor.process(makeEvent())

        expect(wireEventsHandler.onTextMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onAssetMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onPingReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onLocationMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onMessageDeleted).not.toHaveBeenCalled()
        expect(wireEventsHandler.onMessageDelivered).not.toHaveBeenCalled()
        expect(wireEventsHandler.onMessageReactionReceived).not.toHaveBeenCalled()
      })

      it('should deserialize the message with the decrypted bytes, qualified conversation and decrypted sender', async () => {
        vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(makeTextMessage())

        await processor.process(makeEvent())

        expect(ProtobufDeserializer.toWireMessage).toHaveBeenCalledWith(
          decryptedPlaintext,
          qualifiedConversation,
          decryptedSender,
          eventDate
        )
      })

      it('should log an error when the decrypted sender differs from the backend event sender', async () => {
        vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(makeTextMessage())

        await processor.process(makeEvent({id: 'backend-sender', domain: 'example.com'}))

        expect(loggerMock.error).toHaveBeenCalledWith(
          'MLS message sender mismatch between decrypted message and backend event.',
          expect.objectContaining({
            decryptedSender: decryptedSender.toString(),
            eventSender: new QualifiedId('backend-sender', 'example.com').toString()
          })
        )
        expect(ProtobufDeserializer.toWireMessage).toHaveBeenCalledWith(
          decryptedPlaintext,
          qualifiedConversation,
          decryptedSender,
          eventDate
        )
      })
    })

    describe('exception handling', () => {
      it('should call verifyConversationOutOfSync for MlsException and not rethrow', async () => {
        const mlsError = Object.assign(new Error('mls error'), {name: 'MlsException'})
        vi.mocked(coreCryptoService.decryptMlsMessage).mockRejectedValue(mlsError)

        await expect(processor.process(makeEvent())).resolves.toBeUndefined()

        expect(mlsFallbackStrategy.verifyConversationOutOfSync).toHaveBeenCalledTimes(1)
        expect(mlsFallbackStrategy.verifyConversationOutOfSync).toHaveBeenCalledWith(mlsGroupId, qualifiedConversation)
      })

      it('should call verifyConversationOutOfSync for CoreCryptoMlsException and not rethrow', async () => {
        const coreCryptoError = Object.assign(new Error('core crypto error'), {name: 'CoreCryptoMlsException'})
        vi.mocked(coreCryptoService.decryptMlsMessage).mockRejectedValue(coreCryptoError)

        await expect(processor.process(makeEvent())).resolves.toBeUndefined()

        expect(mlsFallbackStrategy.verifyConversationOutOfSync).toHaveBeenCalledTimes(1)
        expect(mlsFallbackStrategy.verifyConversationOutOfSync).toHaveBeenCalledWith(mlsGroupId, qualifiedConversation)
      })

      it('should rethrow unknown exceptions', async () => {
        const unknownError = new Error('unexpected error')
        vi.mocked(coreCryptoService.decryptMlsMessage).mockRejectedValue(unknownError)

        await expect(processor.process(makeEvent())).rejects.toThrow('unexpected error')

        expect(mlsFallbackStrategy.verifyConversationOutOfSync).not.toHaveBeenCalled()
      })
    })
  })
})
