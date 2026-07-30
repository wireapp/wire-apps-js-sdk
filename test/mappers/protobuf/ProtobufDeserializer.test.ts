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
import { QualifiedId } from '../../../src/model/QualifiedId.js'
import { CompositeButton, TextMessage } from "../../../src/index.js"
import {WireMessageType} from "../../../src/model/WireMessage.js";

const { GenericMessage, Confirmation } = rootMessage

describe('Protobuf deserialization', () => {
  const conversationId = new QualifiedId('conversation-id', 'wire.com')
  const senderId = new QualifiedId('sender-id', 'wire.com')
  const timestamp = new Date('2026-06-18T12:00:00.000Z')

  const toWireMessage = (genericMessage: rootMessage.IGenericMessage) =>
    ProtobufDeserializer.toWireMessage(GenericMessage.encode(genericMessage).finish(), conversationId, senderId, timestamp)

  it('deserializes text message mentions', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      text: {
        content: 'Hello @Wire',
        mentions: [{
          qualifiedUserId: {
            id: 'user-id',
            domain: 'wire.com'
          },
          start: 6,
          length: 5
        }]
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.TEXT)
    expect(result.type === WireMessageType.TEXT ? result.mentions : []).toStrictEqual([{
      userId: new QualifiedId('user-id', 'wire.com'),
      offset: 6,
      length: 5
    }])
  })

  it('deserializes missing text message mentions as an empty list', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      text: {
        content: 'No mention'
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.TEXT)
    expect(result.type === WireMessageType.TEXT ? result.mentions : null).toStrictEqual([])
  })

  it('preserves text message ids', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      text: {
        content: 'Hello'
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.TEXT)
    expect(result.type === WireMessageType.TEXT ? result.id : null).toBe('message-id')
  })

  it('preserves received text message metadata', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      text: {
        content: 'Hello'
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.TEXT)
    expect(result.type === WireMessageType.TEXT ? result.sender : null).toStrictEqual(senderId)
    expect(result.type === WireMessageType.TEXT ? result.timestamp : null).toStrictEqual(timestamp)
  })

  it('deserializes ephemeral text messages as expiring text messages', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      ephemeral: {
        expireAfterMillis: 5000,
        text: {
          content: 'Temporary hello',
          mentions: [{
            qualifiedUserId: {
              id: 'user-id',
              domain: 'wire.com'
            },
            start: 10,
            length: 5
          }]
        }
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.TEXT)
    expect(result.type === WireMessageType.TEXT ? result.id : null).toBe('message-id')
    expect(result.type === WireMessageType.TEXT ? result.text : null).toBe('Temporary hello')
    expect(result.type === WireMessageType.TEXT ? result.expiresAfterMillis : null).toBe(5000)
    expect(result.type === WireMessageType.TEXT ? result.sender : null).toStrictEqual(senderId)
    expect(result.type === WireMessageType.TEXT ? result.timestamp : null).toStrictEqual(timestamp)
    expect(result.type === WireMessageType.TEXT ? result.mentions : []).toStrictEqual([{
      userId: new QualifiedId('user-id', 'wire.com'),
      offset: 10,
      length: 5
    }])
  })

  it('deserializes ephemeral asset messages as expiring asset messages', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      ephemeral: {
        expireAfterMillis: 5000,
        asset: {
          original: {
            mimeType: 'image/png',
            size: 123,
            name: 'image.png'
          },
          uploaded: {
            otrKey: new Uint8Array([1, 2, 3]),
            sha256: new Uint8Array([4, 5, 6]),
            assetId: 'asset-id',
            assetToken: 'asset-token',
            assetDomain: 'assets.wire.com'
          }
        }
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.ASSET)
    expect(result.type === WireMessageType.ASSET ? result.id : null).toBe('message-id')
    expect(result.type === WireMessageType.ASSET ? result.expiresAfterMillis : null).toBe(5000)
    expect(result.type === WireMessageType.ASSET ? result.mimeType : null).toBe('image/png')
    expect(result.type === WireMessageType.ASSET ? result.name : null).toBe('image.png')
    expect(result.type === WireMessageType.ASSET ? result.sizeInBytes.toString() : null).toBe('123')
    expect(result.type === WireMessageType.ASSET ? result.remoteData : null).toMatchObject({
      assetId: 'asset-id',
      assetToken: 'asset-token',
      assetDomain: 'assets.wire.com'
    })
    expect(result.type === WireMessageType.ASSET ? result.sender : null).toStrictEqual(senderId)
    expect(result.type === WireMessageType.ASSET ? result.timestamp : null).toStrictEqual(timestamp)
  })

  it('deserializes knocks as pings', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      knock: {
        hotKnock: false
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.PING)
    expect(result.type === WireMessageType.PING ? result.id : null).toBe('message-id')
    expect(result.type === WireMessageType.PING ? result.conversationId : null).toStrictEqual(conversationId)
    expect(result.type === WireMessageType.PING ? result.expiresAfterMillis : undefined).toBeNull()
  })

  it('deserializes ephemeral knocks as expiring pings', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      ephemeral: {
        expireAfterMillis: 1000,
        knock: {
          hotKnock: false
        }
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.PING)
    expect(result.type === WireMessageType.PING ? result.id : null).toBe('message-id')
    expect(result.type === WireMessageType.PING ? result.expiresAfterMillis : null).toBe(1000)
  })

  it('deserializes locations', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      location: {
        latitude: 52.520008,
        longitude: 13.404954,
        name: 'Berlin',
        zoom: 12
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.LOCATION)
    expect(result.type === WireMessageType.LOCATION ? result.id : null).toBe('message-id')
    expect(result.type === WireMessageType.LOCATION ? result.conversationId : null).toStrictEqual(conversationId)
    expect(result.type === WireMessageType.LOCATION ? result.latitude : null).toBeCloseTo(52.520008)
    expect(result.type === WireMessageType.LOCATION ? result.longitude : null).toBeCloseTo(13.404954)
    expect(result.type === WireMessageType.LOCATION ? result.name : null).toBe('Berlin')
    expect(result.type === WireMessageType.LOCATION ? result.zoom : null).toBe(12)
    expect(result.type === WireMessageType.LOCATION ? result.sender : null).toStrictEqual(senderId)
    expect(result.type === WireMessageType.LOCATION ? result.timestamp : null).toStrictEqual(timestamp)
  })

  it('preserves omitted optional location fields as null', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      location: {
        latitude: 52.520008,
        longitude: 13.404954
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.LOCATION)
    expect(result.type === WireMessageType.LOCATION ? result.name : undefined).toBeNull()
    expect(result.type === WireMessageType.LOCATION ? result.zoom : undefined).toBeNull()
  })

  it('preserves explicit location zoom 0', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      location: {
        latitude: 52.520008,
        longitude: 13.404954,
        zoom: 0
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.LOCATION)
    expect(result.type === WireMessageType.LOCATION ? result.zoom : null).toBe(0)
  })

  it('deserializes ephemeral locations as expiring locations', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      ephemeral: {
        expireAfterMillis: 5000,
        location: {
          latitude: 52.520008,
          longitude: 13.404954,
          name: 'Berlin',
          zoom: 12
        }
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.LOCATION)
    expect(result.type === WireMessageType.LOCATION ? result.id : null).toBe('message-id')
    expect(result.type === WireMessageType.LOCATION ? result.expiresAfterMillis : null).toBe(5000)
    expect(result.type === WireMessageType.LOCATION ? result.latitude : null).toBeCloseTo(52.520008)
    expect(result.type === WireMessageType.LOCATION ? result.longitude : null).toBeCloseTo(13.404954)
    expect(result.type === WireMessageType.LOCATION ? result.name : null).toBe('Berlin')
    expect(result.type === WireMessageType.LOCATION ? result.zoom : null).toBe(12)
    expect(result.type === WireMessageType.LOCATION ? result.sender : null).toStrictEqual(senderId)
    expect(result.type === WireMessageType.LOCATION ? result.timestamp : null).toStrictEqual(timestamp)
  })

  it('deserializes deleted messages', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      deleted: {
        messageId: 'deleted-message-id'
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.DELETED)
    expect(result.type === WireMessageType.DELETED ? result.id : null).toBe('message-id')
    expect(result.type === WireMessageType.DELETED ? result.conversationId : null).toStrictEqual(conversationId)
    expect(result.type === WireMessageType.DELETED ? result.messageId : null).toBe('deleted-message-id')
    expect(result.type === WireMessageType.DELETED ? result.sender : null).toStrictEqual(senderId)
  })

  it('deserializes delivered receipts', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      confirmation: {
        type: Confirmation.Type.DELIVERED,
        firstMessageId: 'first-message-id',
        moreMessageIds: ['second-message-id', 'third-message-id']
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.RECEIPT)
    expect(result.type === WireMessageType.RECEIPT ? result.id : null).toBe('message-id')
    expect(result.type === WireMessageType.RECEIPT ? result.conversationId : null).toStrictEqual(conversationId)
    expect(result.type === WireMessageType.RECEIPT ? result.receiptType : null).toBe('DELIVERED')
    expect(result.type === WireMessageType.RECEIPT ? result.messageIds : []).toStrictEqual([
      'first-message-id',
      'second-message-id',
      'third-message-id'
    ])
    expect(result.type === WireMessageType.RECEIPT ? result.sender : null).toStrictEqual(senderId)
  })

  it('deserializes read receipts', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      confirmation: {
        type: Confirmation.Type.READ,
        firstMessageId: 'read-message-id'
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.RECEIPT)
    expect(result.type === WireMessageType.RECEIPT ? result.receiptType : null).toBe('READ')
    expect(result.type === WireMessageType.RECEIPT ? result.messageIds : []).toStrictEqual(['read-message-id'])
  })

  it('ignores unsupported receipt types', () => {
    const genericMessage = GenericMessage.create({
      messageId: 'message-id',
      confirmation: {
        type: 99 as unknown as rootMessage.Confirmation.Type,
        firstMessageId: 'message-id'
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.IGNORED)
  })

  it('deserializes text edited message', () => {
    const wireBlogUrl = "https://wire.com/blog"
    const mention = {
      qualifiedUserId: {
        id: 'user-id',
        domain: 'wire.com'
      },
      start: 6,
      length: 5
    }
    const mentions = [mention]

    const linkPreview = [{
      url: wireBlogUrl,
      urlOffset: 16,
      permanentUrl: wireBlogUrl,
      title: 'Wire',
      summary: 'Secure collaboration',
      image: null
    }]

    const genericMessage = GenericMessage.create({
      messageId: 'edited-message-id',
      edited: {
        replacingMessageId: 'replacing-message-id',
        content: 'text',
        text: {
          content: `Hello @Wire see ${wireBlogUrl}`,
          mentions: mentions,
          linkPreview: linkPreview
        }
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.TEXT_EDITED)
    if (result.type == WireMessageType.TEXT_EDITED) {
      expect(result.id).toBe('edited-message-id')
      expect(result.text).toBe(`Hello @Wire see ${wireBlogUrl}`)
      const resultMention = result.mentions?.at(0)
      expect(resultMention).toBeDefined()
      expect(resultMention!.length).toBe(mention.length)
      expect(resultMention!.offset).toBe(mention.start)
      expect(resultMention!.userId.id).toBe(mention.qualifiedUserId.id)
      expect(resultMention!.userId.domain).toBe(mention.qualifiedUserId.domain)
      expect(result.linkPreviews).toStrictEqual(linkPreview)
    }
  })

  it('deserializes composited message', () => {
    const mention = {
      qualifiedUserId: {
        id: 'user-id',
        domain: 'wire.com'
      },
      start: 6,
      length: 5
    }
    const mentions = [mention]

    const genericMessage = GenericMessage.create({
      messageId: 'edited-message-id',
      composite: {
        items: [
          {
            content: 'text',
            text: {
              content: 'hello @Wire',
              mentions: mentions
            }
          },
          {
            content: 'button',
            button: {
              text: 'text',
              id: 'id'
            }
          }
        ]
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.COMPOSITE)
    if (result.type == WireMessageType.COMPOSITE) {
      expect(result.id).toBe('edited-message-id')

      const firstItem = result.items.at(0) as TextMessage | null | undefined
      expect(firstItem).toBeDefined()
      if (firstItem) {
        expect(firstItem.type).toBe(WireMessageType.TEXT)
        expect(firstItem.text).toBe('hello @Wire')
        const resultMention = firstItem.mentions?.at(0)
        expect(resultMention).toBeDefined()
        expect(resultMention!.length).toBe(mention.length)
        expect(resultMention!.offset).toBe(mention.start)
        expect(resultMention!.userId.id).toBe(mention.qualifiedUserId.id)
        expect(resultMention!.userId.domain).toBe(mention.qualifiedUserId.domain)
      }

      const secondItem = result.items.at(1) as CompositeButton | null | undefined
      expect(secondItem).toBeDefined()
      if (secondItem) {
        expect(secondItem.type).toBe(WireMessageType.COMPOSITE_BUTTON)
        expect(secondItem.id).toBe('id')
        expect(secondItem.text).toBe('text')
      }
    }
  })

  it('deserializes composited edited message', () => {
    const mention = {
      qualifiedUserId: {
        id: 'user-id',
        domain: 'wire.com'
      },
      start: 6,
      length: 5
    }
    const mentions = [mention]

    const genericMessage = GenericMessage.create({
      messageId: 'edited-message-id',
      edited: {
        replacingMessageId: 'replacing-message-id',
        content: 'composite',
        composite: {
          items: [
            {
              content: 'text',
              text: {
                content: 'hello @Wire',
                mentions: mentions
              }
            },
            {
              content: 'button',
              button: {
                text: 'text',
                id: 'id'
              }
            }
          ]
        }
      }
    })

    const result = toWireMessage(genericMessage)

    expect(result.type).toBe(WireMessageType.COMPOSITE_EDITED)
    if (result.type == WireMessageType.COMPOSITE_EDITED) {
      expect(result.id).toBe('edited-message-id')
      expect(result.replacingMessageId).toBe('replacing-message-id')

      const firstItem = result.items.at(0) as TextMessage | null | undefined
      expect(firstItem).toBeDefined()
      if (firstItem) {
        expect(firstItem.type).toBe(WireMessageType.TEXT)
        expect(firstItem.text).toBe('hello @Wire')
        const resultMention = firstItem.mentions?.at(0)
        expect(resultMention).toBeDefined()
        expect(resultMention!.length).toBe(mention.length)
        expect(resultMention!.offset).toBe(mention.start)
        expect(resultMention!.userId.id).toBe(mention.qualifiedUserId.id)
        expect(resultMention!.userId.domain).toBe(mention.qualifiedUserId.domain)
      }

      const secondItem = result.items.at(1) as CompositeButton | null | undefined
      expect(secondItem).toBeDefined()
      if (secondItem) {
        expect(secondItem.type).toBe(WireMessageType.COMPOSITE_BUTTON)
        expect(secondItem.id).toBe('id')
        expect(secondItem.text).toBe('text')
      }
    }
  })
})
