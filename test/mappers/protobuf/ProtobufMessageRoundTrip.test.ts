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

import { describe, expect, it } from 'vitest'
import { ProtobufSerializer } from '../../../src/mappers/protobuf/ProtobufSerializer.js'
import { ProtobufDeserializer } from '../../../src/mappers/protobuf/ProtobufDeserializer.js'
import {
  TextMessage,
  AssetMessage,
  CompositeMessage,
  ButtonActionMessage,
  ButtonActionConfirmationMessage,
  KnockMessage,
  LocationMessage,
  ReactionMessage,
  MessageDeleteMessage,
  MessageEditMessage,
  ConfirmationMessage,
} from '../../../src/model/WireMessage.js'
import type {
  CompositeMessage as CompositeMessageType,
  ButtonActionMessage as ButtonActionMessageType,
  ButtonActionConfirmationMessage as ButtonActionConfirmationMessageType,
  KnockMessage as KnockMessageType,
  LocationMessage as LocationMessageType,
  ReactionMessage as ReactionMessageType,
  MessageDeleteMessage as MessageDeleteMessageType,
  MessageEditMessage as MessageEditMessageType,
  ConfirmationMessage as ConfirmationMessageType,
} from '../../../src/model/WireMessage.js'

const CONVERSATION_ID = { id: 'conv-1', domain: 'wire.com' }

function roundTrip(message: Parameters<typeof ProtobufSerializer.toGenericMessageByteArray>[0]) {
  const bytes = ProtobufSerializer.toGenericMessageByteArray(message)
  return ProtobufDeserializer.toWireMessage(bytes, CONVERSATION_ID)
}

describe('Protobuf message round-trips', () => {

  describe('TextMessage', () => {
    it('preserves text content', () => {
      const original = TextMessage.create({ conversationId: CONVERSATION_ID, text: 'hello world' })
      const result = roundTrip(original)
      expect(result).toMatchObject({ type: 'text', text: 'hello world' })
    })

    it('preserves mentions', () => {
      const mention = { userId: { id: 'user-1', domain: 'wire.com' }, offset: 0, length: 5 }
      const original = TextMessage.create({ conversationId: CONVERSATION_ID, text: '@Alice', mentions: [mention] })
      const result = roundTrip(original)
      expect(result).toMatchObject({ type: 'text', mentions: [mention] })
    })

    it('preserves quote fields', () => {
      const sha = new Uint8Array([1, 2, 3])
      const original = TextMessage.create({
        conversationId: CONVERSATION_ID,
        text: 'reply',
        quotedMessageId: 'msg-abc',
        quotedMessageSha256: sha,
      })
      const result = roundTrip(original)
      expect(result).toMatchObject({ type: 'text', quotedMessageId: 'msg-abc' })
      expect((result as typeof original).quotedMessageSha256).toStrictEqual(sha)
    })

    it('preserves expiresAfterMillis as ephemeral', () => {
      const original = TextMessage.create({ conversationId: CONVERSATION_ID, text: 'disappears', expiresAfterMillis: 5000 })
      const result = roundTrip(original)
      expect(result).toMatchObject({ type: 'text', text: 'disappears', expiresAfterMillis: 5000 })
    })
  })

  describe('AssetMessage', () => {
    it('preserves image metadata', () => {
      const original = AssetMessage.create({
        conversationId: CONVERSATION_ID,
        mimeType: 'image/png',
        sizeInBytes: 1024,
        name: 'photo.png',
        metadata: { type: 'image', width: 800, height: 600 },
      })
      const result = roundTrip(original)
      expect(result).toMatchObject({
        type: 'asset',
        mimeType: 'image/png',
        name: 'photo.png',
        metadata: { type: 'image', width: 800, height: 600 },
      })
    })

    it('preserves audio metadata', () => {
      const loudness = new Uint8Array([10, 20, 30])
      const original = AssetMessage.create({
        conversationId: CONVERSATION_ID,
        mimeType: 'audio/ogg',
        sizeInBytes: 512,
        metadata: { type: 'audio', durationMs: 3000, normalizedLoudness: loudness },
      })
      const result = roundTrip(original)
      expect(result).toMatchObject({ type: 'asset', metadata: { type: 'audio', durationMs: 3000 } })
    })

    it('preserves expiresAfterMillis as ephemeral', () => {
      const original = AssetMessage.create({
        conversationId: CONVERSATION_ID,
        mimeType: 'image/jpeg',
        sizeInBytes: 2048,
        expiresAfterMillis: 10000,
      })
      const result = roundTrip(original)
      expect(result).toMatchObject({ type: 'asset', expiresAfterMillis: 10000 })
    })
  })

  describe('CompositeMessage', () => {
    it('preserves text and button items', () => {
      const original = CompositeMessage.create({
        conversationId: CONVERSATION_ID,
        items: [
          { text: { content: 'Pick one:' } },
          { button: { text: 'Yes', id: 'btn-yes' } },
          { button: { text: 'No', id: 'btn-no' } },
        ],
      })
      const result = roundTrip(original) as CompositeMessageType
      expect(result.type).toBe('composite')
      expect(result.items).toStrictEqual([
        { text: { content: 'Pick one:' } },
        { button: { text: 'Yes', id: 'btn-yes' } },
        { button: { text: 'No', id: 'btn-no' } },
      ])
    })

    it('preserves expectsReadConfirmation', () => {
      const original = CompositeMessage.create({
        conversationId: CONVERSATION_ID,
        items: [{ button: { text: 'OK', id: 'btn-ok' } }],
        expectsReadConfirmation: true,
      })
      const result = roundTrip(original)
      expect(result).toMatchObject({ type: 'composite', expectsReadConfirmation: true })
    })
  })

  describe('ButtonActionMessage', () => {
    it('preserves buttonId and referenceMessageId', () => {
      const original = ButtonActionMessage.create({
        conversationId: CONVERSATION_ID,
        buttonId: 'btn-yes',
        referenceMessageId: 'msg-ref-1',
      })
      const result = roundTrip(original) as ButtonActionMessageType
      expect(result.type).toBe('buttonAction')
      expect(result.buttonId).toBe('btn-yes')
      expect(result.referenceMessageId).toBe('msg-ref-1')
    })
  })

  describe('ButtonActionConfirmationMessage', () => {
    it('preserves referenceMessageId and buttonId', () => {
      const original = ButtonActionConfirmationMessage.create({
        conversationId: CONVERSATION_ID,
        referenceMessageId: 'msg-ref-1',
        buttonId: 'btn-yes',
      })
      const result = roundTrip(original) as ButtonActionConfirmationMessageType
      expect(result.type).toBe('buttonActionConfirmation')
      expect(result.referenceMessageId).toBe('msg-ref-1')
      expect(result.buttonId).toBe('btn-yes')
    })

    it('preserves absent buttonId when no button is accepted', () => {
      const original = ButtonActionConfirmationMessage.create({
        conversationId: CONVERSATION_ID,
        referenceMessageId: 'msg-ref-1',
        buttonId: null,
      })
      const result = roundTrip(original) as ButtonActionConfirmationMessageType
      expect(result.type).toBe('buttonActionConfirmation')
      expect(result.buttonId).toBeNull()
    })
  })

  describe('KnockMessage', () => {
    it('preserves hotKnock flag', () => {
      const original = KnockMessage.create({ conversationId: CONVERSATION_ID, hotKnock: true })
      const result = roundTrip(original) as KnockMessageType
      expect(result.type).toBe('knock')
      expect(result.hotKnock).toBe(true)
    })

    it('defaults hotKnock to false', () => {
      const original = KnockMessage.create({ conversationId: CONVERSATION_ID })
      const result = roundTrip(original) as KnockMessageType
      expect(result.hotKnock).toBe(false)
    })

    it('preserves expiresAfterMillis as ephemeral', () => {
      const original = KnockMessage.create({ conversationId: CONVERSATION_ID, hotKnock: false, expiresAfterMillis: 3000 })
      const result = roundTrip(original) as KnockMessageType
      expect(result.type).toBe('knock')
      expect(result.expiresAfterMillis).toBe(3000)
    })
  })

  describe('LocationMessage', () => {
    it('preserves coordinates and name', () => {
      const original = LocationMessage.create({
        conversationId: CONVERSATION_ID,
        longitude: 13.405,
        latitude: 52.52,
        name: 'Berlin',
        zoom: 10,
      })
      const result = roundTrip(original) as LocationMessageType
      expect(result.type).toBe('location')
      expect(result.longitude).toBeCloseTo(13.405)
      expect(result.latitude).toBeCloseTo(52.52)
      expect(result.name).toBe('Berlin')
      expect(result.zoom).toBe(10)
    })

    it('preserves expiresAfterMillis as ephemeral', () => {
      const original = LocationMessage.create({
        conversationId: CONVERSATION_ID,
        longitude: 0,
        latitude: 0,
        expiresAfterMillis: 7000,
      })
      const result = roundTrip(original) as LocationMessageType
      expect(result.type).toBe('location')
      expect(result.expiresAfterMillis).toBe(7000)
    })
  })

  describe('ReactionMessage', () => {
    it('preserves emoji and targetMessageId', () => {
      const original = ReactionMessage.create({
        conversationId: CONVERSATION_ID,
        emoji: '👍',
        targetMessageId: 'msg-target-1',
      })
      const result = roundTrip(original) as ReactionMessageType
      expect(result.type).toBe('reaction')
      expect(result.emoji).toBe('👍')
      expect(result.targetMessageId).toBe('msg-target-1')
    })

    it('preserves empty emoji for reaction removal', () => {
      const original = ReactionMessage.create({
        conversationId: CONVERSATION_ID,
        emoji: '',
        targetMessageId: 'msg-target-1',
      })
      const result = roundTrip(original) as ReactionMessageType
      expect(result.emoji).toBe('')
    })
  })

  describe('MessageDeleteMessage', () => {
    it('preserves targetMessageId', () => {
      const original = MessageDeleteMessage.create({
        conversationId: CONVERSATION_ID,
        targetMessageId: 'msg-to-delete',
      })
      const result = roundTrip(original) as MessageDeleteMessageType
      expect(result.type).toBe('messageDelete')
      expect(result.targetMessageId).toBe('msg-to-delete')
    })
  })

  describe('MessageEditMessage', () => {
    it('preserves text edit', () => {
      const original = MessageEditMessage.create({
        conversationId: CONVERSATION_ID,
        replacingMessageId: 'msg-original',
        text: 'corrected text',
      })
      const result = roundTrip(original) as MessageEditMessageType
      expect(result.type).toBe('messageEdit')
      expect(result.replacingMessageId).toBe('msg-original')
      expect(result.text).toBe('corrected text')
    })

    it('preserves composite edit with items', () => {
      const composite = CompositeMessage.create({
        conversationId: CONVERSATION_ID,
        items: [
          { text: { content: 'Updated question' } },
          { button: { text: 'Accept', id: 'btn-accept' } },
        ],
      })
      const original = MessageEditMessage.create({
        conversationId: CONVERSATION_ID,
        replacingMessageId: 'msg-original',
        composite,
      })
      const result = roundTrip(original) as MessageEditMessageType
      expect(result.type).toBe('messageEdit')
      expect(result.replacingMessageId).toBe('msg-original')
      expect(result.composite?.items).toStrictEqual([
        { text: { content: 'Updated question' } },
        { button: { text: 'Accept', id: 'btn-accept' } },
      ])
    })

    it('throws when neither text nor composite is set', () => {
      const invalid = MessageEditMessage.create({
        conversationId: CONVERSATION_ID,
        replacingMessageId: 'msg-original',
        text: null,
        composite: null,
      })
      expect(() => ProtobufSerializer.toGenericMessageByteArray(invalid)).toThrowError()
    })
  })

  describe('ConfirmationMessage', () => {
    it('preserves delivered confirmation', () => {
      const original = ConfirmationMessage.create({
        conversationId: CONVERSATION_ID,
        confirmationType: 'delivered',
        firstMessageId: 'msg-1',
      })
      const result = roundTrip(original) as ConfirmationMessageType
      expect(result.type).toBe('confirmation')
      expect(result.confirmationType).toBe('delivered')
      expect(result.firstMessageId).toBe('msg-1')
    })

    it('preserves read confirmation with multiple message ids', () => {
      const original = ConfirmationMessage.create({
        conversationId: CONVERSATION_ID,
        confirmationType: 'read',
        firstMessageId: 'msg-1',
        moreMessageIds: ['msg-2', 'msg-3'],
      })
      const result = roundTrip(original) as ConfirmationMessageType
      expect(result.confirmationType).toBe('read')
      expect(result.firstMessageId).toBe('msg-1')
      expect(result.moreMessageIds).toStrictEqual(['msg-2', 'msg-3'])
    })
  })

})
