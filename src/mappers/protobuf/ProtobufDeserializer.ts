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

import rootMessage from "../../generated/messages.js";
import type {Composite as ProtobufComposite, IGenericMessage, IText, IAsset, ILocation} from "../../generated/messages.js";
import { QualifiedId } from "../../model/QualifiedId.js";
const { GenericMessage, Confirmation } = rootMessage;
import type {
  WireMessage,
  AssetMetadata,
  Image,
  Audio,
  Video,
  AssetRemoteData,
  Mention
} from "../../model/WireMessage.js";
import {
  TextMessage,
  TextEditedMessage,
  Unknown,
  AssetMessage,
  CompositeButton,
  CompositeButtonAction,
  CompositeButtonActionConfirmation,
  CompositeMessage,
  CompositeEditedMessage,
  Ping,
  Location,
  DeletedMessage,
  Receipt,
  ReceiptType,
  Reaction,
  Ignored
} from '../../model/WireMessage.js';
import {MessageEncryptionAlgorithm} from "../../model/protobuf/MessageEncryptionAlgorithm.js";
import {MessageLinkPreviewMapper} from "./MessageLinkPreviewMapper.js";
import {MessageMentionMapper} from "./MessageMentionMapper.js";

/**
 * Utility object responsible for mapping a GenericMessage to WireMessage
 */
export const ProtobufDeserializer = {
  /**
   * Converts a GenericMessage to a WireMessage
   */
  toWireMessage: (
    message: Uint8Array,
    qualifiedConversation: QualifiedId,
    senderId: QualifiedId,
    timestamp: Date
  ): WireMessage => {
    const genericMessage = GenericMessage.decode(message)

    if (genericMessage.text) {
      return unpackTextMessage(genericMessage, qualifiedConversation, senderId, timestamp)
    } else if (genericMessage.edited) {
      return unpackEditedMessage(genericMessage, qualifiedConversation, senderId)
    } else if (genericMessage.asset) {
      return unpackAssetMessage(genericMessage, qualifiedConversation, senderId, timestamp)
    } else if (genericMessage.buttonAction) {
      return unpackCompositeButtonAction(genericMessage, qualifiedConversation, senderId)
    } else if (genericMessage.buttonActionConfirmation) {
      return unpackCompositeButtonActionConfirmation(genericMessage, qualifiedConversation, senderId)
    } else if (genericMessage.composite) {
      return unpackComposite(genericMessage, qualifiedConversation, senderId)
    } else if (genericMessage.knock) {
      return unpackPing(genericMessage, qualifiedConversation, senderId)
    } else if (genericMessage.ephemeral) {
      return unpackEphemeral(genericMessage, qualifiedConversation, senderId, timestamp)
    } else if (genericMessage.location) {
      return unpackLocation(genericMessage, qualifiedConversation, senderId, timestamp)
    } else if (genericMessage.deleted) {
      return unpackDeletedMessage(genericMessage, qualifiedConversation, senderId)
    } else if (genericMessage.confirmation) {
      return unpackReceipt(genericMessage, qualifiedConversation, senderId)
    } else if (genericMessage.reaction) {
      return unpackReaction(genericMessage, qualifiedConversation, senderId)
    } else {
      return new Unknown()
    }
  }
}

function unpackTextMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId,
  senderId: QualifiedId,
  timestamp: Date,
  expiresAfterMillis?: number | null | undefined
): TextMessage {
  return TextMessage.create({
    messageId: genericMessage.messageId,
    conversationId: qualifiedConversation,
    text: genericMessage.text!.content,
    linkPreviews: genericMessage.text!.linkPreview?.map(MessageLinkPreviewMapper.fromProtobuf) ?? [],
    mentions: genericMessage.text!.mentions
      ?.map(MessageMentionMapper.fromProtobuf)
      .filter((mention): mention is Mention => mention !== null) ?? [],
    senderId: senderId,
    timestamp: timestamp,
    expiresAfterMillis: expiresAfterMillis
  })
}

function unpackEditedMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId,
  senderId: QualifiedId
): TextEditedMessage | CompositeEditedMessage | Ignored {
  const messageEdit = genericMessage.edited
  if (messageEdit?.text) {
    return TextEditedMessage.create({
      replacingMessageId: messageEdit.replacingMessageId,
      messageId: genericMessage.messageId,
      conversationId: qualifiedConversation,
      text: messageEdit.text.content ?? "",
      linkPreviews: messageEdit.text.linkPreview?.map(MessageLinkPreviewMapper.fromProtobuf) ?? [],
      mentions: messageEdit.text.mentions
        ?.map(MessageMentionMapper.fromProtobuf)
        .filter((mention): mention is Mention => mention !== null) ?? [],
      senderId: senderId
    })
  } else if (messageEdit?.composite) {
    return CompositeEditedMessage.create({
      replacingMessageId: messageEdit.replacingMessageId,
      messageId: genericMessage.messageId,
      conversationId: qualifiedConversation,
      itemList: unpackItemList(qualifiedConversation, messageEdit.composite.items ?? []),
      senderId: senderId
    })
  }
  // TODO: instead add other paths, i.e. composite and multipart, as specified in https://github.com/wireapp/generic-message-proto/blob/master/proto/messages.proto#L218
  return new Ignored()
}

function unpackAssetMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId,
  senderId: QualifiedId,
  timestamp: Date,
  expiresAfterMillis?: number | null | undefined
): AssetMessage {
  const asset = genericMessage.asset
  const original = asset?.original

  let metadata: AssetMetadata | null = null

  if (original?.image) {
    metadata = original.image as Image
  } else if (original?.audio) {
    metadata = original.audio as Audio
  } else if (original?.video) {
    metadata = original.video as Video
  }

  let remoteData: AssetRemoteData | null = null
  if (asset?.uploaded) {
    remoteData = {
      otrKey: asset.uploaded.otrKey,
      sha256: asset.uploaded.sha256,
      assetId: asset.uploaded.assetId!,
      assetDomain: asset.uploaded.assetDomain!,
      assetToken: asset.uploaded.assetToken!,
      encryptionAlgorithm: asset.uploaded.encryption as unknown as MessageEncryptionAlgorithm
    }
  }

  return AssetMessage.create({
    messageId: genericMessage.messageId,
    conversationId: qualifiedConversation,
    metadata: metadata,
    mimeType: original?.mimeType ?? "*/*",
    name: original?.name ?? null,
    remoteData: remoteData,
    sizeInBytes: original?.size ?? 0,
    senderId: senderId,
    timestamp: timestamp,
    expiresAfterMillis: expiresAfterMillis
  })
}

function unpackItemList(
  conversationId: QualifiedId,
  compositeItemList: ProtobufComposite.Item.$Properties[]
): (TextMessage | CompositeButton)[] {
  return compositeItemList.flatMap((item): (TextMessage | CompositeButton)[] => {
    switch (item.content) {
      case 'text':
        return item.text ? [TextMessage.create({
          conversationId: conversationId,
          text: item.text.content,
          mentions: item.text.mentions?.map(MessageMentionMapper.fromProtobuf)
            .filter((mention): mention is Mention => mention !== null) ?? []
        })] : []
      case 'button':
        return item.button ? [CompositeButton.create({ id: item.button.id, text: item.button.text })] : []
      default:
        return []
    }
  })
}

function unpackCompositeButtonAction(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId,
  senderId: QualifiedId
): CompositeButtonAction {
  return CompositeButtonAction.create({
    messageId: genericMessage.messageId,
    conversationId: qualifiedConversation,
    referenceMessageId: genericMessage.buttonAction!.referenceMessageId,
    buttonId: genericMessage.buttonAction!.buttonId,
    senderId: senderId
  })
}

function unpackCompositeButtonActionConfirmation(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId,
  senderId: QualifiedId
): CompositeButtonActionConfirmation {
  const buttonActionConfirmation = genericMessage.buttonActionConfirmation!
  const buttonId = Object.prototype.hasOwnProperty.call(buttonActionConfirmation, 'buttonId')
    ? buttonActionConfirmation.buttonId ?? null
    : null
  return CompositeButtonActionConfirmation.create({
    messageId: genericMessage.messageId,
    conversationId: qualifiedConversation,
    referenceMessageId: buttonActionConfirmation.referenceMessageId,
    buttonId: buttonId,
    senderId: senderId
  })
}

function unpackComposite(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId,
  senderId: QualifiedId
): CompositeMessage {
  const items = genericMessage.composite!.items!
  const itemList = unpackItemList(qualifiedConversation, items)

  return CompositeMessage.create({
    messageId: genericMessage.messageId,
    conversationId: qualifiedConversation,
    itemList: itemList,
    senderId: senderId
  })
}

function unpackPing(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId,
  senderId: QualifiedId,
  expiresAfterMillis?: number | null | undefined
): Ping {
  return Ping.create({
    messageId: genericMessage.messageId,
    conversationId: qualifiedConversation,
    senderId: senderId,
    expiresAfterMillis: expiresAfterMillis
  })
}

function unpackLocation(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId,
  senderId: QualifiedId,
  timestamp: Date,
  expiresAfterMillis?: number | null
): Location {
  const location = genericMessage.location!

  return Location.create({
    messageId: genericMessage.messageId,
    conversationId: qualifiedConversation,
    latitude: location.latitude,
    longitude: location.longitude,
    name: Object.hasOwn(location, 'name') ? location.name : null,
    zoom: Object.hasOwn(location, 'zoom') ? location.zoom : null,
    senderId: senderId,
    timestamp: timestamp,
    expiresAfterMillis: expiresAfterMillis
  })
}

function unpackDeletedMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId,
  senderId: QualifiedId
): DeletedMessage {
  const deletedMessage = genericMessage.deleted!

  return DeletedMessage.create({
    id: genericMessage.messageId,
    conversationId: qualifiedConversation,
    messageId: deletedMessage.messageId,
    senderId: senderId
  })
}

function unpackReceipt(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId,
  senderId: QualifiedId
): Receipt | Ignored {
  const receipt = genericMessage.confirmation!
  let type: ReceiptType | null | undefined

  switch (receipt?.type) {
    case Confirmation.Type.DELIVERED:
      type = ReceiptType.DELIVERED
      break
    case Confirmation.Type.READ:
      type = ReceiptType.READ
      break
    default:
      type = null
  }

  if (type) {
    return Receipt.create({
      id: genericMessage.messageId,
      conversationId: qualifiedConversation,
      receiptType: type,
      messageIds: [receipt.firstMessageId, ...(receipt.moreMessageIds ?? [])],
      senderId: senderId
    })
  } else {
    return new Ignored()
  }
}

function unpackReaction(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId,
  senderId: QualifiedId
): Reaction {
  const reaction = genericMessage.reaction!

  const emoji = reaction.emoji
  const emojiSet = new Set(
    (emoji ?? "")
      .split(",")
      .map(emojiString => emojiString.trim())
      .filter(emojiString => emojiString.length > 0)
  )

  return Reaction.create({
    id: genericMessage.messageId,
    conversationId: qualifiedConversation,
    messageId: reaction.messageId,
    emojiSet: emojiSet,
    senderId: senderId
  })
}

function unpackEphemeral(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId,
  senderId: QualifiedId,
  timestamp: Date
): WireMessage {
  const ephemeralMessage = genericMessage.ephemeral!

  const builtMessage: Partial<IGenericMessage> = {
    messageId: genericMessage.messageId
  }

  if (ephemeralMessage.text) {
    const textContent = ephemeralMessage.text!
    const textMessage: IText = {
      content: textContent.content!,
      mentions: textContent.mentions!,
      linkPreview: textContent.linkPreview!,
      expectsReadConfirmation: textContent.expectsReadConfirmation!,
      legalHoldStatus: textContent.legalHoldStatus!
    }

    return unpackTextMessage(
      {
        ...builtMessage,
        text: textMessage
      } as IGenericMessage,
      qualifiedConversation,
      senderId,
      timestamp,
      toNumber(ephemeralMessage.expireAfterMillis)
    )
  } else if (ephemeralMessage.asset) {
    const assetContent = ephemeralMessage.asset!
    const assetMessage: IAsset = {
      original: assetContent.original!,
      uploaded: assetContent.uploaded!,
      notUploaded: assetContent.notUploaded!,
      expectsReadConfirmation: assetContent.expectsReadConfirmation!
    }

    return unpackAssetMessage(
      {
        ...builtMessage,
        asset: assetMessage
      } as IGenericMessage,
      qualifiedConversation,
      senderId,
      timestamp,
      toNumber(ephemeralMessage.expireAfterMillis)
    )
  } else if (ephemeralMessage.knock) {
    return unpackPing(
      {
        ...builtMessage
      } as IGenericMessage,
      qualifiedConversation,
      senderId,
      toNumber(ephemeralMessage.expireAfterMillis)
    )
  } else if (ephemeralMessage.location) {
    const locationContent = ephemeralMessage.location!
    const locationMessage: ILocation = {
      latitude: locationContent.latitude,
      longitude: locationContent.longitude,
      name: locationContent.name!,
      zoom: locationContent.zoom!
    }

    return unpackLocation(
      {
        ...builtMessage,
        location: locationMessage,
      } as IGenericMessage,
      qualifiedConversation,
      senderId,
      timestamp,
      toNumber(ephemeralMessage.expireAfterMillis)
    )
  } else {
    return new Ignored()
  }
}

/**
 * Normalizes protobufjs integer values to plain numbers.
 * Depending on protobufjs runtime configuration, int64 fields may decode as
 * either JavaScript numbers or Long-like objects.
 */
function toNumber(value: number | { toNumber(): number }): number {
  return typeof value === 'number' ? value : value.toNumber()
}
