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

import protobufMessage from '../../generated/messages.js'
import {
  AssetMessage,
  CompositeButton,
  CompositeButtonAction,
  CompositeButtonActionConfirmation,
  CompositeEditedMessage,
  CompositeMessage,
  type DeletedMessage,
  type Item,
  type Location,
  type Ping,
  type Reaction,
  type Receipt,
  ReceiptType,
  TextEditedMessage,
  TextMessage,
  type WireMessage,
  WireMessageType
} from '../../model/WireMessage.js'
import {MessageLinkPreviewMapper} from './MessageLinkPreviewMapper.js'
import {MessageMentionMapper} from './MessageMentionMapper.js'
import {CryptographicSystemError} from '../../exception/WireException.js'

/**
 * Utility object responsible for serializing WireMessage to GenericMessage
 */
export const ProtobufSerializer = {
  /**
   * Converts a WireMessage to a GenericMessage Byte Array
   *
   * @param wireMessage The message to serialize
   * @returns Uint8Array containing the serialized protobuf message
   * @throws Error if the message type is not supported
   */
  toGenericMessageByteArray: (wireMessage: WireMessage): Uint8Array => {
    const genericMessage: protobufMessage.GenericMessage.$Properties = {
      messageId: wireMessage.id
    }

    let builtMessage: protobufMessage.GenericMessage.$Properties

    switch (wireMessage.type) {
      case WireMessageType.TEXT:
        builtMessage = packTextMessage(wireMessage, genericMessage)
        break

      case WireMessageType.TEXT_EDITED:
        builtMessage = packTextEditedMessage(wireMessage, genericMessage)
        break

      case WireMessageType.ASSET:
        builtMessage = packAssetMessage(wireMessage, genericMessage)
        break

      case WireMessageType.COMPOSITE_BUTTON_ACTION:
        builtMessage = packCompositeButtonAction(wireMessage, genericMessage)
        break

      case WireMessageType.COMPOSITE_BUTTON_ACTION_CONFIRMATION:
        builtMessage = packCompositeButtonActionConfirmation(wireMessage, genericMessage)
        break

      case WireMessageType.COMPOSITE:
        builtMessage = packCompositeMessage(wireMessage, genericMessage)
        break

      case WireMessageType.COMPOSITE_EDITED:
        builtMessage = packCompositeEditedMessage(wireMessage, genericMessage)
        break

      case WireMessageType.PING:
        builtMessage = packPing(wireMessage, genericMessage)
        break

      case WireMessageType.LOCATION:
        builtMessage = packLocation(wireMessage, genericMessage)
        break

      case WireMessageType.DELETED:
        builtMessage = packDeletedMessage(wireMessage, genericMessage)
        break

      case WireMessageType.RECEIPT:
        builtMessage = packReceipt(wireMessage, genericMessage)
        break

      case WireMessageType.REACTION:
        builtMessage = packReaction(wireMessage, genericMessage)
        break

      default:
        throw new CryptographicSystemError(`Unsupported message type: ${(wireMessage as WireMessage).type}`)
    }

    const message = protobufMessage.GenericMessage.create(builtMessage)
    return protobufMessage.GenericMessage.encode(message).finish()
  }
}

/**
 * Packs a text message into the GenericMessage format
 */
function packTextMessage(
  wireMessage: TextMessage,
  genericMessage: protobufMessage.GenericMessage.$Properties
): protobufMessage.GenericMessage.$Properties {
  const textContent = packText(wireMessage)

  return {
    ...genericMessage,
    ...(wireMessage.expiresAfterMillis
      ? {
          ephemeral: protobufMessage.Ephemeral.create({
            expireAfterMillis: wireMessage.expiresAfterMillis,
            text: textContent
          })
        }
      : {
          text: textContent
        })
  }
}

function packText(wireMessage: TextMessage) {
  const textContent: protobufMessage.Text.$Properties = {
    content: wireMessage.text,
    // Add other text-specific fields
    mentions: wireMessage.mentions?.map(MessageMentionMapper.toProtobuf) ?? [],
    linkPreview: wireMessage.linkPreviews?.map((it) => MessageLinkPreviewMapper.toProtobuf(it)) ?? [],
    expectsReadConfirmation: false,
    legalHoldStatus: null
  }

  if (wireMessage.quotedMessageId) {
    textContent.quote = {
      quotedMessageId: wireMessage.quotedMessageId!,
      ...(wireMessage.quotedMessageSha256 !== undefined ? {quotedMessageSha256: wireMessage.quotedMessageSha256} : {})
    }
  }

  return textContent
}

function packTextEditedMessage(
  wireMessage: TextEditedMessage,
  genericMessage: protobufMessage.GenericMessage.$Properties
): protobufMessage.GenericMessage.$Properties {
  return {
    ...genericMessage,
    edited: protobufMessage.MessageEdit.create({
      replacingMessageId: wireMessage.replacingMessageId,
      text: {
        content: wireMessage.text,
        mentions: wireMessage.mentions?.map(MessageMentionMapper.toProtobuf) ?? [],
        linkPreview: wireMessage.linkPreviews?.map((it) => MessageLinkPreviewMapper.toProtobuf(it)) ?? []
      }
    })
  }
}

function packAssetMessage(
  wireMessage: AssetMessage,
  genericMessage: protobufMessage.GenericMessage.$Properties
): protobufMessage.GenericMessage.$Properties {
  const original: protobufMessage.Asset.Original.$Properties = {
    mimeType: wireMessage.mimeType,
    size: wireMessage.sizeInBytes,
    name: wireMessage.name ?? null
  }

  if (wireMessage.metadata) {
    if (wireMessage.metadata.type === 'image') {
      original.image = {
        width: wireMessage.metadata.width,
        height: wireMessage.metadata.height
      }
    } else if (wireMessage.metadata.type === 'audio') {
      original.audio = {}
      if (wireMessage.metadata.durationMs) {
        original.audio.durationInMillis = wireMessage.metadata.durationMs
      }
      if (wireMessage.metadata.normalizedLoudness) {
        original.audio.normalizedLoudness = wireMessage.metadata.normalizedLoudness
      }
    } else if (wireMessage.metadata.type === 'video') {
      original.video = {}
      if (wireMessage.metadata.width) {
        original.video.width = wireMessage.metadata.width
      }
      if (wireMessage.metadata.height) {
        original.video.height = wireMessage.metadata.height
      }
      if (wireMessage.metadata.durationMs) {
        original.video.durationInMillis = wireMessage.metadata.durationMs
      }
    }
  }

  const uploaded: protobufMessage.Asset.RemoteData.$Properties = {
    otrKey: wireMessage.remoteData?.otrKey || new Uint8Array(),
    sha256: wireMessage.remoteData?.sha256 || new Uint8Array(),
    assetId: wireMessage.remoteData?.assetId || null,
    assetToken: wireMessage.remoteData?.assetToken || null,
    assetDomain: wireMessage.remoteData?.assetDomain || null
  }

  const assetContent: protobufMessage.Asset.$Properties = {
    original,
    uploaded
  }

  return {
    ...genericMessage,
    ...(wireMessage.expiresAfterMillis
      ? {
          ephemeral: protobufMessage.Ephemeral.create({
            expireAfterMillis: wireMessage.expiresAfterMillis,
            asset: assetContent
          })
        }
      : {
          asset: assetContent
        })
  }
}

function packItemList(itemsList: Item[]): protobufMessage.Composite.Item[] {
  return itemsList.flatMap((item) => {
    switch ((item as TextMessage | CompositeButton).type) {
      case WireMessageType.COMPOSITE_BUTTON: {
        const button = item as CompositeButton
        return [
          protobufMessage.Composite.Item.create({
            content: 'button',
            button: {id: button.id, text: button.text}
          })
        ]
      }
      case WireMessageType.TEXT: {
        return [
          protobufMessage.Composite.Item.create({
            content: 'text',
            text: packText(item as TextMessage)
          })
        ]
      }
      default:
        return []
    }
  })
}

function packCompositeButtonAction(
  wireMessage: CompositeButtonAction,
  genericMessage: protobufMessage.GenericMessage.$Properties
): protobufMessage.GenericMessage.$Properties {
  const buttonAction: protobufMessage.ButtonAction.$Properties = {
    referenceMessageId: wireMessage.referenceMessageId,
    buttonId: wireMessage.buttonId
  }

  return {
    ...genericMessage,
    buttonAction: buttonAction
  }
}

function packCompositeButtonActionConfirmation(
  wireMessage: CompositeButtonActionConfirmation,
  genericMessage: protobufMessage.GenericMessage.$Properties
): protobufMessage.GenericMessage.$Properties {
  const buttonActionConfirmation: protobufMessage.ButtonActionConfirmation.$Properties = {
    referenceMessageId: wireMessage.referenceMessageId,
    buttonId: wireMessage.buttonId
  }

  return {
    ...genericMessage,
    buttonActionConfirmation: buttonActionConfirmation
  }
}

function packCompositeMessage(
  wireMessage: CompositeMessage,
  genericMessage: protobufMessage.GenericMessage.$Properties
): protobufMessage.GenericMessage.$Properties {
  return {
    ...genericMessage,
    composite: protobufMessage.Composite.create({
      items: packItemList(wireMessage.items)
    })
  }
}

function packCompositeEditedMessage(
  wireMessage: CompositeEditedMessage,
  genericMessage: protobufMessage.GenericMessage.$Properties
): protobufMessage.GenericMessage.$Properties {
  return {
    ...genericMessage,
    edited: protobufMessage.MessageEdit.create({
      replacingMessageId: wireMessage.replacingMessageId,
      composite: {
        items: packItemList(wireMessage.items)
      }
    })
  }
}

function packPing(
  wireMessage: Ping,
  genericMessage: protobufMessage.GenericMessage.$Properties
): protobufMessage.GenericMessage.$Properties {
  const knock = protobufMessage.Knock.create({hotKnock: false})
  return {
    ...genericMessage,
    ...(wireMessage.expiresAfterMillis
      ? {
          ephemeral: protobufMessage.Ephemeral.create({
            expireAfterMillis: wireMessage.expiresAfterMillis,
            knock: knock
          })
        }
      : {
          knock: knock
        })
  }
}

function packLocation(
  wireMessage: Location,
  genericMessage: protobufMessage.GenericMessage.$Properties
): protobufMessage.GenericMessage.$Properties {
  const locationContent = protobufMessage.Location.create({
    latitude: wireMessage.latitude,
    longitude: wireMessage.longitude,
    name: wireMessage.name,
    zoom: wireMessage.zoom
  })

  return {
    ...genericMessage,
    ...(wireMessage.expiresAfterMillis
      ? {
          ephemeral: protobufMessage.Ephemeral.create({
            expireAfterMillis: wireMessage.expiresAfterMillis,
            location: locationContent
          })
        }
      : {
          location: locationContent
        })
  }
}

function packDeletedMessage(
  wireMessage: DeletedMessage,
  genericMessage: protobufMessage.GenericMessage.$Properties
): protobufMessage.GenericMessage.$Properties {
  return {
    ...genericMessage,
    deleted: protobufMessage.MessageDelete.create({
      messageId: wireMessage.messageId
    })
  }
}

function packReceipt(
  wireMessage: Receipt,
  genericMessage: protobufMessage.GenericMessage.$Properties
): protobufMessage.GenericMessage.$Properties {
  let type
  switch (wireMessage.receiptType) {
    case ReceiptType.DELIVERED:
      type = protobufMessage.Confirmation.Type.DELIVERED
      break
    case ReceiptType.READ:
      type = protobufMessage.Confirmation.Type.READ
      break
  }

  const [firstMessageId, ...moreMessageIds] = wireMessage.messageIds

  if (!firstMessageId) {
    throw new CryptographicSystemError('First messageId for Receipt message type is null')
  }

  return {
    ...genericMessage,
    confirmation: protobufMessage.Confirmation.create({
      type: type,
      firstMessageId: firstMessageId,
      moreMessageIds: moreMessageIds
    })
  }
}

function packReaction(
  wireMessage: Reaction,
  genericMessage: protobufMessage.GenericMessage.$Properties
): protobufMessage.GenericMessage.$Properties {
  const emojis = [...wireMessage.emojiSet]
    .map((emojiString) => emojiString.trim())
    .filter((emojiString) => emojiString.length > 0)
    .join(',')

  return {
    ...genericMessage,
    reaction: protobufMessage.Reaction.create({
      messageId: wireMessage.messageId,
      emoji: emojis
    })
  }
}
