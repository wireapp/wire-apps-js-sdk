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

vi.mock('../../../src/api/ConversationService.js')
vi.mock('../../../src/core/CoreCryptoService.js')
vi.mock('../../../src/service/MlsFallbackStrategy.js')
vi.mock('../../../src/mappers/protobuf/ProtobufDeserializer.js')

const qualifiedConversation = {id: 'conv-123', domain: 'example.com'}
const mlsGroupId = 'mls-group-id'
const decryptedMessage = new Uint8Array([1, 2, 3])

const makeEvent = (): NewMLSMessageDTO => ({
  type: 'conversation.mls-message-add',
  time: new Date(),
  data: 'base64encodeddata',
  qualified_conversation: qualifiedConversation,
  qualified_from: {id: 'user-from', domain: 'example.com'},
})

const makeTextMessage = () => ({type: 'text' as const, text: 'hello'} as any)
const makeAssetMessage = () => ({type: 'asset' as const, mimeType: 'image/png', sizeInBytes: 1024} as any)
const makePing = () => ({type: 'ping' as const, id: 'ping-id'} as any)
const makeLocationMessage = () => ({type: 'location' as const, id: 'location-id'} as any)
const makeDeletedMessage = () => ({type: 'deleted' as const, id: 'message-id', messageId: 'deleted-message-id'} as any)
const makeUnknownMessage = () => ({type: 'unknown' as const} as any)

let conversationService: ConversationService
let coreCryptoService: CoreCryptoService
let mlsFallbackStrategy: MlsFallbackStrategy
let wireEventsHandler: WireEventsHandler
let processor: MlsMessageEventProcessor

beforeEach(() => {
  vi.clearAllMocks()

  conversationService = {
    getConversationMLSGroupId: vi.fn().mockResolvedValue(mlsGroupId),
  } as any

  coreCryptoService = {
    decryptMls: vi.fn().mockResolvedValue(decryptedMessage),
  } as any

  mlsFallbackStrategy = {
    verifyConversationOutOfSync: vi.fn().mockResolvedValue(undefined),
  } as any

  wireEventsHandler = {
    onTextMessageReceived: vi.fn().mockResolvedValue(undefined),
    onAssetMessageReceived: vi.fn().mockResolvedValue(undefined),
    onPingReceived: vi.fn().mockResolvedValue(undefined),
    onLocationReceived: vi.fn().mockResolvedValue(undefined),
    onMessageDeleted: vi.fn().mockResolvedValue(undefined),
  } as any

  processor = new MlsMessageEventProcessor(coreCryptoService, conversationService, mlsFallbackStrategy, wireEventsHandler)
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

      expect(coreCryptoService.decryptMls).toHaveBeenCalledTimes(1)
      expect(coreCryptoService.decryptMls).toHaveBeenCalledWith(mlsGroupId, event.data)
    })

    it('should return early without forwarding if decryption returns null', async () => {
      vi.mocked(coreCryptoService.decryptMls).mockResolvedValue(undefined)

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

      it('should call onLocationReceived for location messages', async () => {
        const locationMessage = makeLocationMessage()
        vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(locationMessage)

        await processor.process(makeEvent())

        expect(wireEventsHandler.onLocationReceived).toHaveBeenCalledTimes(1)
        expect(wireEventsHandler.onLocationReceived).toHaveBeenCalledWith(locationMessage)
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
        expect(wireEventsHandler.onLocationReceived).not.toHaveBeenCalled()
      })

      it('should not forward unknown message types', async () => {
        vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(makeUnknownMessage())

        await processor.process(makeEvent())

        expect(wireEventsHandler.onTextMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onAssetMessageReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onPingReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onLocationReceived).not.toHaveBeenCalled()
        expect(wireEventsHandler.onMessageDeleted).not.toHaveBeenCalled()
      })

      it('should deserialize the message with the decrypted bytes and qualified conversation', async () => {
        vi.mocked(ProtobufDeserializer.toWireMessage).mockReturnValue(makeTextMessage())

        await processor.process(makeEvent())

        expect(ProtobufDeserializer.toWireMessage).toHaveBeenCalledWith(decryptedMessage, qualifiedConversation)
      })
    })

    describe('exception handling', () => {
      it('should call verifyConversationOutOfSync for MlsException and not rethrow', async () => {
        const mlsError = Object.assign(new Error('mls error'), {name: 'MlsException'})
        vi.mocked(coreCryptoService.decryptMls).mockRejectedValue(mlsError)

        await expect(processor.process(makeEvent())).resolves.toBeUndefined()

        expect(mlsFallbackStrategy.verifyConversationOutOfSync).toHaveBeenCalledTimes(1)
        expect(mlsFallbackStrategy.verifyConversationOutOfSync).toHaveBeenCalledWith(mlsGroupId, qualifiedConversation)
      })

      it('should call verifyConversationOutOfSync for CoreCryptoMlsException and not rethrow', async () => {
        const coreCryptoError = Object.assign(new Error('core crypto error'), {name: 'CoreCryptoMlsException'})
        vi.mocked(coreCryptoService.decryptMls).mockRejectedValue(coreCryptoError)

        await expect(processor.process(makeEvent())).resolves.toBeUndefined()

        expect(mlsFallbackStrategy.verifyConversationOutOfSync).toHaveBeenCalledTimes(1)
        expect(mlsFallbackStrategy.verifyConversationOutOfSync).toHaveBeenCalledWith(mlsGroupId, qualifiedConversation)
      })

      it('should rethrow unknown exceptions', async () => {
        const unknownError = new Error('unexpected error')
        vi.mocked(coreCryptoService.decryptMls).mockRejectedValue(unknownError)

        await expect(processor.process(makeEvent())).rejects.toThrow('unexpected error')

        expect(mlsFallbackStrategy.verifyConversationOutOfSync).not.toHaveBeenCalled()
      })
    })
  })
})
