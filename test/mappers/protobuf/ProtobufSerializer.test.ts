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

import { describe, expect, it } from 'vitest'
import rootMessage from '../../../src/generated/messages.js'
import { ProtobufDeserializer } from '../../../src/mappers/protobuf/ProtobufDeserializer.js'
import { ProtobufSerializer } from '../../../src/mappers/protobuf/ProtobufSerializer.js'
import { QualifiedId } from '../../../src/model/QualifiedId.js'
import { AssetMessage, CompositeButtonActionConfirmation, DeletedMessage, Location, Ping, Reaction, Receipt, ReceiptType, TextMessage } from '../../../src/model/WireMessage.js'

const { GenericMessage, Confirmation } = rootMessage

const wireBlogUrl = "https://wire.com/blog"

describe('Protobuf serialization', () => {
  const conversationId = new QualifiedId('conversation-id', 'wire.com')

  it('serializes text message link previews', () => {
    const message = TextMessage.create({
      conversationId,
      text: `Read ${wireBlogUrl}`,
      linkPreviews: [{
        url: wireBlogUrl,
        urlOffset: 5,
        permanentUrl: wireBlogUrl,
        title: 'Wire',
        summary: 'Secure collaboration',
        image: null
      }]
    })

    const serialized = ProtobufSerializer.toGenericMessageByteArray(message)
    const result = GenericMessage.decode(serialized)

    expect(result.text?.linkPreview).toHaveLength(1)
    expect(result.text?.linkPreview![0]).toMatchObject({
      url: wireBlogUrl,
      urlOffset: 5,
      permanentUrl: wireBlogUrl,
      title: 'Wire',
      summary: 'Secure collaboration'
    })
  })

  it('serializes missing text message link previews as an empty list', () => {
    const message = TextMessage.create({
      conversationId,
      text: 'No preview'
    })

    const serialized = ProtobufSerializer.toGenericMessageByteArray(message)
    const result = GenericMessage.decode(serialized)

    expect(result.text?.linkPreview).toStrictEqual([])
  })

  it('serializes text message mentions', () => {
    const message = TextMessage.create({
      conversationId,
      text: 'Hello @Wire',
      mentions: [{
        userId: new QualifiedId('user-id', 'wire.com'),
        offset: 6,
        length: 5
      }]
    })

    const serialized = ProtobufSerializer.toGenericMessageByteArray(message)
    const result = GenericMessage.decode(serialized)

    expect(result.text?.mentions).toMatchObject([{
      qualifiedUserId: {
        id: 'user-id',
        domain: 'wire.com'
      },
      start: 6,
      length: 5
    }])
  })

  it('serializes expiring text messages as ephemeral text', () => {
    const message = TextMessage.create({
      messageId: 'message-id',
      conversationId,
      text: 'Temporary hello',
      expiresAfterMillis: 5000
    })

    const serialized = ProtobufSerializer.toGenericMessageByteArray(message)
    const result = GenericMessage.decode(serialized)

    expect(result.messageId).toBe('message-id')
    expect(result.content).toBe('ephemeral')
    expect(result.text).toBeNull()
    expect(result.ephemeral?.expireAfterMillis.toString()).toBe('5000')
    expect(result.ephemeral?.content).toBe('text')
    expect(result.ephemeral?.text?.content).toBe('Temporary hello')
  })

  it('serializes expiring asset messages as ephemeral assets', () => {
    const message = AssetMessage.create({
      messageId: 'message-id',
      conversationId,
      mimeType: 'image/png',
      name: 'image.png',
      sizeInBytes: 123,
      remoteData: {
        otrKey: new Uint8Array([1, 2, 3]),
        sha256: new Uint8Array([4, 5, 6]),
        assetId: 'asset-id',
        assetToken: 'asset-token',
        assetDomain: 'assets.wire.com'
      },
      expiresAfterMillis: 5000
    })

    const serialized = ProtobufSerializer.toGenericMessageByteArray(message)
    const result = GenericMessage.decode(serialized)

    expect(result.messageId).toBe('message-id')
    expect(result.content).toBe('ephemeral')
    expect(result.asset).toBeNull()
    expect(result.ephemeral?.expireAfterMillis.toString()).toBe('5000')
    expect(result.ephemeral?.content).toBe('asset')
    expect(result.ephemeral?.asset?.original?.mimeType).toBe('image/png')
    expect(result.ephemeral?.asset?.original?.size.toString()).toBe('123')
    expect(result.ephemeral?.asset?.uploaded?.assetId).toBe('asset-id')
  })

  it('deserializes text message link previews', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      text: {
        content: `Read ${wireBlogUrl}`,
        linkPreview: [{
          url: wireBlogUrl,
          urlOffset: 5,
          permanentUrl: wireBlogUrl,
          title: 'Wire',
          summary: 'Secure collaboration'
        }]
      }
    })

    const result = ProtobufDeserializer.toWireMessage(GenericMessage.encode(genericMessage).finish(), conversationId)

    expect(result.type).toBe('text')
    expect(result.type === 'text' ? result.linkPreviews : []).toStrictEqual([{
      url: wireBlogUrl,
      urlOffset: 5,
      permanentUrl: wireBlogUrl,
      title: 'Wire',
      summary: 'Secure collaboration',
      image: null
    }])
  })

  it('deserializes missing text message link previews as an empty list', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      text: {
        content: 'No preview',
        linkPreview: []
      }
    })

    const result = ProtobufDeserializer.toWireMessage(GenericMessage.encode(genericMessage).finish(), conversationId)

    expect(result.type).toBe('text')
    expect(result.type === 'text' ? result.linkPreviews : null).toStrictEqual([])
  })

  it('serializes composite button action confirmations', () => {
    const message = CompositeButtonActionConfirmation.create({
      messageId: 'message-id',
      conversationId,
      referenceMessageId: 'reference-message-id',
      buttonId: 'button-id'
    })

    const serialized = ProtobufSerializer.toGenericMessageByteArray(message)
    const result = GenericMessage.decode(serialized)

    expect(result.messageId).toBe('message-id')
    expect(result.content).toBe('buttonActionConfirmation')
    expect(result.buttonActionConfirmation).toMatchObject({
      referenceMessageId: 'reference-message-id',
      buttonId: 'button-id'
    })
  })

  it('serializes pings as knocks', () => {
    const message = Ping.create({
      messageId: 'message-id',
      conversationId
    })

    const serialized = ProtobufSerializer.toGenericMessageByteArray(message)
    const result = GenericMessage.decode(serialized)

    expect(result.messageId).toBe('message-id')
    expect(result.content).toBe('knock')
    expect(result.knock).toMatchObject({
      hotKnock: false
    })
  })

  it('serializes expiring pings as ephemeral knocks', () => {
    const message = Ping.create({
      messageId: 'message-id',
      conversationId,
      expiresAfterMillis: 1000
    })

    const serialized = ProtobufSerializer.toGenericMessageByteArray(message)
    const result = GenericMessage.decode(serialized)

    expect(result.messageId).toBe('message-id')
    expect(result.content).toBe('ephemeral')
    expect(result.ephemeral?.expireAfterMillis.toString()).toBe('1000')
    expect(result.ephemeral?.content).toBe('knock')
    expect(result.ephemeral?.knock).toMatchObject({
      hotKnock: false
    })
  })

  it('serializes locations', () => {
    const message = Location.create({
      messageId: 'message-id',
      conversationId,
      latitude: 52.520008,
      longitude: 13.404954,
      name: 'Berlin',
      zoom: 12
    })

    const serialized = ProtobufSerializer.toGenericMessageByteArray(message)
    const result = GenericMessage.decode(serialized)

    expect(result.messageId).toBe('message-id')
    expect(result.content).toBe('location')
    expect(result.location?.latitude).toBeCloseTo(52.520008)
    expect(result.location?.longitude).toBeCloseTo(13.404954)
    expect(result.location?.name).toBe('Berlin')
    expect(result.location?.zoom).toBe(12)
  })

  it('serializes expiring locations as ephemeral locations', () => {
    const message = Location.create({
      messageId: 'message-id',
      conversationId,
      latitude: 52.520008,
      longitude: 13.404954,
      name: 'Berlin',
      zoom: 12,
      expiresAfterMillis: 5000
    })

    const serialized = ProtobufSerializer.toGenericMessageByteArray(message)
    const result = GenericMessage.decode(serialized)

    expect(result.messageId).toBe('message-id')
    expect(result.content).toBe('ephemeral')
    expect(result.location).toBeNull()
    expect(result.ephemeral?.expireAfterMillis.toString()).toBe('5000')
    expect(result.ephemeral?.content).toBe('location')
    expect(result.ephemeral?.location?.latitude).toBeCloseTo(52.520008)
    expect(result.ephemeral?.location?.longitude).toBeCloseTo(13.404954)
    expect(result.ephemeral?.location?.name).toBe('Berlin')
    expect(result.ephemeral?.location?.zoom).toBe(12)
  })

  it('serializes deleted messages', () => {
    const message = DeletedMessage.create({
      id: 'message-id',
      conversationId,
      messageId: 'deleted-message-id'
    })

    const serialized = ProtobufSerializer.toGenericMessageByteArray(message)
    const result = GenericMessage.decode(serialized)

    expect(result.messageId).toBe('message-id')
    expect(result.content).toBe('deleted')
    expect(result.deleted?.messageId).toBe('deleted-message-id')
  })

  it('serializes delivered receipts', () => {
    const message = Receipt.create({
      id: 'message-id',
      conversationId,
      receiptType: ReceiptType.DELIVERED,
      messageIds: ['first-message-id', 'second-message-id', 'third-message-id']
    })

    const serialized = ProtobufSerializer.toGenericMessageByteArray(message)
    const result = GenericMessage.decode(serialized)

    expect(result.messageId).toBe('message-id')
    expect(result.content).toBe('confirmation')
    expect(result.confirmation?.type).toBe(Confirmation.Type.DELIVERED)
    expect(result.confirmation?.firstMessageId).toBe('first-message-id')
    expect(result.confirmation?.moreMessageIds).toStrictEqual(['second-message-id', 'third-message-id'])
  })

  it('serializes read receipts', () => {
    const message = Receipt.create({
      id: 'message-id',
      conversationId,
      receiptType: ReceiptType.READ,
      messageIds: ['read-message-id']
    })

    const serialized = ProtobufSerializer.toGenericMessageByteArray(message)
    const result = GenericMessage.decode(serialized)

    expect(result.content).toBe('confirmation')
    expect(result.confirmation?.type).toBe(Confirmation.Type.READ)
    expect(result.confirmation?.firstMessageId).toBe('read-message-id')
    expect(result.confirmation?.moreMessageIds).toStrictEqual([])
  })

  it('serializes reactions', () => {
    const message = Reaction.create({
      id: 'reaction-message-id',
      conversationId,
      messageId: 'target-message-id',
      emojiSet: new Set(['🧩'])
    })

    const serialized = ProtobufSerializer.toGenericMessageByteArray(message)
    const result = GenericMessage.decode(serialized)

    expect(result.messageId).toBe('reaction-message-id')
    expect(result.content).toBe('reaction')
    expect(result.reaction?.messageId).toBe('target-message-id')
    expect(result.reaction?.emoji).toBe('🧩')
  })

  it('throws when serializing receipts without message ids', () => {
    const message = Receipt.create({
      id: 'message-id',
      conversationId,
      receiptType: ReceiptType.DELIVERED,
      messageIds: []
    })

    expect(() => ProtobufSerializer.toGenericMessageByteArray(message)).toThrow(
      'First messageId for Receipt message type is null'
    )
  })

  it('deserializes composite button action confirmations', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      buttonActionConfirmation: {
        referenceMessageId: 'reference-message-id',
        buttonId: 'button-id'
      }
    })

    const result = ProtobufDeserializer.toWireMessage(GenericMessage.encode(genericMessage).finish(), conversationId)

    expect(result.type).toBe('composite_button_action_confirmation')
    expect(result.type === 'composite_button_action_confirmation' ? result.id : null).toBe('message-id')
    expect(result.type === 'composite_button_action_confirmation' ? result.referenceMessageId : null).toBe('reference-message-id')
    expect(result.type === 'composite_button_action_confirmation' ? result.buttonId : null).toBe('button-id')
  })

  it('deserializes composite button action confirmations without a button id', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      buttonActionConfirmation: {
        referenceMessageId: 'reference-message-id'
      }
    })

    const result = ProtobufDeserializer.toWireMessage(GenericMessage.encode(genericMessage).finish(), conversationId)

    expect(result.type).toBe('composite_button_action_confirmation')
    expect(result.type === 'composite_button_action_confirmation' ? result.referenceMessageId : null).toBe('reference-message-id')
    expect(result.type === 'composite_button_action_confirmation' ? result.buttonId : undefined).toBeNull()
  })

  it('deserializes reactions', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'reaction-message-id',
      reaction: {
        messageId: 'target-message-id',
        emoji: '🧩'
      }
    })

    const result = ProtobufDeserializer.toWireMessage(GenericMessage.encode(genericMessage).finish(), conversationId)

    expect(result.type).toBe('reaction')
    expect(result.type === 'reaction' ? result.id : null).toBe('reaction-message-id')
    expect(result.type === 'reaction' ? result.messageId : null).toBe('target-message-id')
    expect(result.type === 'reaction' ? [...result.emojiSet] : []).toStrictEqual(['🧩'])
  })
})
