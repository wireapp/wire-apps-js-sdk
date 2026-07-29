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

import {describe, expect, it} from 'vitest'
import {
  AssetMessage,
  CompositeButton,
  CompositeButtonAction,
  CompositeButtonActionConfirmation,
  CompositeEditedMessage,
  CompositeMessage,
  DeletedMessage,
  Ignored,
  Location,
  Ping,
  Reaction,
  Receipt,
  ReceiptType,
  TextEditedMessage,
  TextMessage,
  Unknown
} from '../../src/model/WireMessage.js'
import {QualifiedId} from '../../src/model/QualifiedId.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('WireMessage', () => {
  const conversationId = new QualifiedId('conversation-1', 'example.com')
  const senderId = new QualifiedId('sender-1', 'example.com')

  describe('TextMessage.create', () => {
    it('should create a text message with required fields and defaults', () => {
      const message = TextMessage.create({conversationId, text: 'hello'})

      expect(message.type).toBe('text')
      expect(message.id).toMatch(UUID_REGEX)
      expect(message.conversationId).toBe(conversationId)
      expect(message.text).toBe('hello')
      expect(message.mentions).toEqual([])
      expect(message.linkPreviews).toEqual([])
      expect(message.expiresAfterMillis).toBeNull()
      expect(message.timestamp).toBeInstanceOf(Date)
    })

    it('should use provided messageId, sender, timestamp and expiresAfterMillis', () => {
      const timestamp = new Date('2026-01-01T00:00:00.000Z')

      const message = TextMessage.create({
        messageId: 'custom-id',
        conversationId,
        text: 'hello',
        senderId,
        timestamp,
        expiresAfterMillis: 5000
      })

      expect(message.id).toBe('custom-id')
      expect(message.sender).toBe(senderId)
      expect(message.timestamp).toBe(timestamp)
      expect(message.expiresAfterMillis).toBe(5000)
    })

    it('should preserve provided mentions and linkPreviews', () => {
      const mentions = [{userId: senderId, offset: 0, length: 4}]
      const linkPreviews = [{urlOffset: 0, url: 'https://wire.com'}]

      const message = TextMessage.create({conversationId, text: 'hi @user', mentions, linkPreviews})

      expect(message.mentions).toBe(mentions)
      expect(message.linkPreviews).toBe(linkPreviews)
    })
  })

  describe('TextMessage.createReply', () => {
    it('should create a reply referencing the original text message', () => {
      const original = TextMessage.create({conversationId, text: 'original text'})

      const reply = TextMessage.createReply({text: 'a reply', originalMessage: original})

      expect(reply.type).toBe('text')
      expect(reply.conversationId).toBe(original.conversationId)
      expect(reply.quotedMessageId).toBe(original.id)
      expect(reply.text).toBe('a reply')
    })

    it('should compute a non-null 32-byte quotedMessageSha256 for a repliable original', () => {
      const original = TextMessage.create({conversationId, text: 'original text'})

      const reply = TextMessage.createReply({text: 'a reply', originalMessage: original})

      expect(reply.quotedMessageSha256).toBeInstanceOf(Uint8Array)
      expect(reply.quotedMessageSha256).toHaveLength(32)
    })

    it('should allow replying to an asset message', () => {
      const original = AssetMessage.create({
        conversationId,
        sizeInBytes: 1024,
        mimeType: 'image/png'
      })

      const reply = TextMessage.createReply({text: 'nice picture', originalMessage: original})

      expect(reply.conversationId).toBe(original.conversationId)
      expect(reply.quotedMessageId).toBe(original.id)
    })

    it('should allow replying to a location message', () => {
      const original = Location.create({conversationId, latitude: 1.23, longitude: 4.56})

      const reply = TextMessage.createReply({text: 'nice spot', originalMessage: original})

      expect(reply.conversationId).toBe(original.conversationId)
      expect(reply.quotedMessageId).toBe(original.id)
    })

    it('should throw when the original message type is not replyable', () => {
      const original = Ping.create({conversationId})

      expect(() =>
        TextMessage.createReply({text: 'a reply', originalMessage: original})
      ).toThrow(/Cannot reply to unreplyable WireMessage type/)
    })

    it('should throw when replying to an Unknown message', () => {
      const original = new Unknown()

      expect(() =>
        TextMessage.createReply({text: 'a reply', originalMessage: original})
      ).toThrow(/Cannot reply to unreplyable WireMessage type/)
    })

    it('should throw when replying to an Ignored message', () => {
      const original = new Ignored()

      expect(() =>
        TextMessage.createReply({text: 'a reply', originalMessage: original})
      ).toThrow(/Cannot reply to unreplyable WireMessage type/)
    })

    it('should throw when the original message is ephemeral (expiring)', () => {
      const original = TextMessage.create({
        conversationId,
        text: 'vanishing text',
        expiresAfterMillis: 10_000
      })

      expect(() =>
        TextMessage.createReply({text: 'a reply', originalMessage: original})
      ).toThrow(/Cannot reply to an expiring message/)
    })

    it('should default mentions and linkPreviews to empty arrays', () => {
      const original = TextMessage.create({conversationId, text: 'original text'})

      const reply = TextMessage.createReply({text: 'a reply', originalMessage: original})

      expect(reply.mentions).toEqual([])
      expect(reply.linkPreviews).toEqual([])
    })

    it('should use provided messageId, senderId, timestamp and expiresAfterMillis', () => {
      const original = TextMessage.create({conversationId, text: 'original text'})
      const timestamp = new Date('2026-02-02T00:00:00.000Z')

      const reply = TextMessage.createReply({
        messageId: 'reply-id',
        text: 'a reply',
        originalMessage: original,
        senderId,
        timestamp,
        expiresAfterMillis: 3000
      })

      expect(reply.id).toBe('reply-id')
      expect(reply.sender).toBe(senderId)
      expect(reply.timestamp).toBe(timestamp)
      expect(reply.expiresAfterMillis).toBe(3000)
    })
  })

  describe('TextEditedMessage.create', () => {
    it('should create a text-edited message with defaults', () => {
      const message = TextEditedMessage.create({
        conversationId,
        replacingMessageId: 'original-id',
        text: 'edited text'
      })

      expect(message.type).toBe('text-edited')
      expect(message.replacingMessageId).toBe('original-id')
      expect(message.text).toBe('edited text')
      expect(message.mentions).toEqual([])
      expect(message.linkPreviews).toEqual([])
    })
  })

  describe('AssetMessage.create', () => {
    it('should create an asset message with defaults', () => {
      const message = AssetMessage.create({conversationId, sizeInBytes: 2048, mimeType: 'image/jpeg'})

      expect(message.type).toBe('asset')
      expect(message.sizeInBytes).toBe(2048)
      expect(message.mimeType).toBe('image/jpeg')
      expect(message.name).toBeNull()
      expect(message.metadata).toBeNull()
      expect(message.remoteData).toBeNull()
      expect(message.expiresAfterMillis).toBeNull()
    })
  })

  describe('CompositeButton.create', () => {
    it('should create a composite button with a generated id by default', () => {
      const button = CompositeButton.create({text: 'Yes'})

      expect(button.type).toBe('composite_button')
      expect(button.text).toBe('Yes')
      expect(button.id).toMatch(UUID_REGEX)
    })

    it('should use the provided id when given', () => {
      const button = CompositeButton.create({text: 'No', id: 'custom-button-id'})

      expect(button.id).toBe('custom-button-id')
    })
  })

  describe('CompositeButtonAction.create', () => {
    it('should create a composite button action', () => {
      const action = CompositeButtonAction.create({
        messageId: 'action-id',
        conversationId,
        referenceMessageId: 'ref-id',
        buttonId: 'button-id'
      })

      expect(action.type).toBe('composite_button_action')
      expect(action.id).toBe('action-id')
      expect(action.referenceMessageId).toBe('ref-id')
      expect(action.buttonId).toBe('button-id')
    })
  })

  describe('CompositeButtonActionConfirmation.create', () => {
    it('should create a confirmation without a sender by default', () => {
      const confirmation = CompositeButtonActionConfirmation.create({
        messageId: 'confirmation-id',
        conversationId,
        referenceMessageId: 'ref-id',
        buttonId: 'button-id'
      })

      expect(confirmation.type).toBe('composite_button_action_confirmation')
      expect(confirmation.buttonId).toBe('button-id')
      expect(confirmation.sender).toBeUndefined()
    })

    it('should allow a null buttonId', () => {
      const confirmation = CompositeButtonActionConfirmation.create({
        messageId: 'confirmation-id',
        conversationId,
        referenceMessageId: 'ref-id',
        buttonId: null
      })

      expect(confirmation.buttonId).toBeNull()
    })
  })

  describe('CompositeMessage.create', () => {
    it('should prepend a text item when text is provided', () => {
      const button = CompositeButton.create({text: 'Option A'})

      const message = CompositeMessage.create({
        conversationId,
        text: 'Pick one',
        itemList: [button]
      })

      expect(message.items).toHaveLength(2)
      expect(message.items[0]).toMatchObject({type: 'text', text: 'Pick one'})
      expect(message.items[1]).toBe(button)
    })

    it('should not prepend a text item when text is omitted', () => {
      const button = CompositeButton.create({text: 'Option A'})

      const message = CompositeMessage.create({conversationId, itemList: [button]})

      expect(message.items).toEqual([button])
    })
  })

  describe('CompositeEditedMessage.create', () => {
    it('should create a composite-edited message with a leading text item', () => {
      const button = CompositeButton.create({text: 'Option B'})

      const message = CompositeEditedMessage.create({
        conversationId,
        replacingMessageId: 'original-id',
        itemList: [button]
      })

      expect(message.type).toBe('composite-edited')
      expect(message.replacingMessageId).toBe('original-id')
      expect(message.items).toHaveLength(1)
    })
  })

  describe('Ping.create', () => {
    it('should create a ping message without a sender by default', () => {
      const ping = Ping.create({conversationId})

      expect(ping.type).toBe('ping')
      expect(ping.expiresAfterMillis).toBeNull()
      expect(ping.sender).toBeUndefined()
    })
  })

  describe('Location.create', () => {
    it('should create a location message with defaults', () => {
      const location = Location.create({conversationId, latitude: 52.52, longitude: 13.405})

      expect(location.type).toBe('location')
      expect(location.latitude).toBe(52.52)
      expect(location.longitude).toBe(13.405)
      expect(location.name).toBeNull()
      expect(location.zoom).toBeNull()
    })
  })

  describe('DeletedMessage.create', () => {
    it('should create a deleted message referencing the deleted messageId', () => {
      const deleted = DeletedMessage.create({conversationId, messageId: 'deleted-msg-id'})

      expect(deleted.type).toBe('deleted')
      expect(deleted.messageId).toBe('deleted-msg-id')
      expect(deleted.sender).toBeUndefined()
    })
  })

  describe('Receipt.create', () => {
    it('should create a receipt message with the given type and messageIds', () => {
      const receipt = Receipt.create({
        conversationId,
        receiptType: ReceiptType.READ,
        messageIds: ['msg-1', 'msg-2']
      })

      expect(receipt.type).toBe('receipt')
      expect(receipt.receiptType).toBe(ReceiptType.READ)
      expect(receipt.messageIds).toEqual(['msg-1', 'msg-2'])
    })
  })

  describe('Reaction.create', () => {
    it('should create a reaction message without a sender by default', () => {
      const reaction = Reaction.create({
        conversationId,
        messageId: 'reacted-msg-id',
        emojiSet: new Set(['👍'])
      })

      expect(reaction.type).toBe('reaction')
      expect(reaction.messageId).toBe('reacted-msg-id')
      expect(reaction.emojiSet.has('👍')).toBe(true)
      expect(reaction.sender).toBeUndefined()
    })
  })

  describe('Unknown', () => {
    it('should throw on every accessor', () => {
      const unknown = new Unknown()

      expect(unknown.type).toBe('unknown')
      expect(() => unknown.id).toThrow(/Unknown message, no ID/)
      expect(() => unknown.conversationId).toThrow(/Unknown message, no conversation/)
      expect(() => unknown.sender).toThrow(/Unknown message, no sender/)
      expect(() => unknown.timestamp).toThrow(/Unknown message, no timestamp/)
    })
  })

  describe('Ignored', () => {
    it('should throw on every accessor', () => {
      const ignored = new Ignored()

      expect(ignored.type).toBe('ignored')
      expect(() => ignored.id).toThrow(/Ignored message, no ID/)
      expect(() => ignored.conversationId).toThrow(/Ignored message, no conversation/)
      expect(() => ignored.sender).toThrow(/Ignored message, no sender/)
      expect(() => ignored.timestamp).toThrow(/Ignored message, no timestamp/)
    })
  })
})
