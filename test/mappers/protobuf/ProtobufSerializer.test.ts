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
import { CompositeButtonActionConfirmation, TextMessage } from '../../../src/model/WireMessage.js'

const { GenericMessage } = rootMessage

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
    expect(result.text?.linkPreview[0]).toMatchObject({
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
})
