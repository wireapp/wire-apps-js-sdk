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

import rootMessage, { type IGenericMessage } from "../../generated/messages.js";
import type { QualifiedId } from "../../model/QualifiedId.js";
const { GenericMessage, Confirmation } = rootMessage;
import {
  TextMessage,
  Unknown,
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
} from '../../model/WireMessage.js';
import type {
  WireMessage,
  AssetMetadata,
  Image,
  Audio,
  Video,
  AssetRemoteData,
  CompositeItem,
  ConfirmationType,
} from "../../model/WireMessage.js";
import { MessageEncryptionAlgorithm } from "../../model/protobuf/MessageEncryptionAlgorithm.js";

/**
 * Utility object responsible for mapping a GenericMessage to WireMessage
 */
export const ProtobufDeserializer = {
  /**
   * Converts a GenericMessage to a WireMessage
   */
  toWireMessage: (
    message: Uint8Array,
    qualifiedConversation: QualifiedId
  ): WireMessage => {
    const genericMessage = GenericMessage.decode(message)

    if (genericMessage.ephemeral) {
      return unpackEphemeralMessage(genericMessage, qualifiedConversation)
    } else if (genericMessage.text) {
      return unpackTextMessage(genericMessage, qualifiedConversation)
    } else if (genericMessage.asset) {
      return unpackAssetMessage(genericMessage, qualifiedConversation)
    } else if (genericMessage.composite) {
      return unpackCompositeMessage(genericMessage, qualifiedConversation)
    } else if (genericMessage.buttonAction) {
      return unpackButtonActionMessage(genericMessage, qualifiedConversation)
    } else if (genericMessage.buttonActionConfirmation) {
      return unpackButtonActionConfirmationMessage(genericMessage, qualifiedConversation)
    } else if (genericMessage.knock) {
      return unpackKnockMessage(genericMessage, qualifiedConversation)
    } else if (genericMessage.location) {
      return unpackLocationMessage(genericMessage, qualifiedConversation)
    } else if (genericMessage.reaction) {
      return unpackReactionMessage(genericMessage, qualifiedConversation)
    } else if (genericMessage.deleted) {
      return unpackMessageDeleteMessage(genericMessage, qualifiedConversation)
    } else if (genericMessage.edited) {
      return unpackMessageEditMessage(genericMessage, qualifiedConversation)
    } else if (genericMessage.confirmation) {
      return unpackConfirmationMessage(genericMessage, qualifiedConversation)
    } else {
      return new Unknown()
    }
  }
}

function unpackTextMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): TextMessage {
  const text = genericMessage.text!
  return TextMessage.create({
    conversationId: qualifiedConversation,
    text: text.content,
    mentions: (text.mentions ?? []).map(m => ({
      userId: m.qualifiedUserId
        ? { id: m.qualifiedUserId.id, domain: m.qualifiedUserId.domain }
        : { id: m.userId ?? '', domain: '' },
      offset: m.start,
      length: m.length,
    })),
    linkPreviews: (text.linkPreview ?? []).map(lp => ({
      url: lp.url,
      urlOffset: lp.urlOffset,
      permanentUrl: lp.permanentUrl ?? null,
      title: lp.title ?? null,
      summary: lp.summary ?? null,
      image: lp.image?.original
        ? {
            name: lp.image.original.name ?? null,
            mimeType: lp.image.original.mimeType ?? null,
            sizeInBytes: lp.image.original.size ?? null,
          }
        : null,
    })),
    quotedMessageId: text.quote?.quotedMessageId ?? null,
    quotedMessageSha256: text.quote?.quotedMessageSha256
      ? new Uint8Array(text.quote.quotedMessageSha256)
      : null,
  })
}

function unpackAssetMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): AssetMessage {
  const asset = genericMessage.asset
  const original = asset?.original

  let metadata: AssetMetadata | null = null

  if (original?.image) {
    metadata = { type: 'image', width: original.image.width, height: original.image.height } as Image
  } else if (original?.audio) {
    metadata = {
      type: 'audio',
      durationMs: original.audio.durationInMillis ? Number(original.audio.durationInMillis) : undefined,
      normalizedLoudness: original.audio.normalizedLoudness ?? undefined,
    } as Audio
  } else if (original?.video) {
    metadata = {
      type: 'video',
      width: original.video.width ?? undefined,
      height: original.video.height ?? undefined,
      durationMs: original.video.durationInMillis ? Number(original.video.durationInMillis) : undefined,
    } as Video
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
    conversationId: qualifiedConversation,
    metadata: metadata,
    mimeType: original?.mimeType ?? "*/*",
    name: original?.name ?? null,
    remoteData: remoteData,
    sizeInBytes: original?.size ?? 0
  })
}

function unpackEphemeralMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): WireMessage {
  const ephemeral = genericMessage.ephemeral!
  const expiresAfterMillis = Number(ephemeral.expireAfterMillis)

  if (ephemeral.text) {
    const text = ephemeral.text
    return TextMessage.create({
      conversationId: qualifiedConversation,
      text: text.content,
      mentions: (text.mentions ?? []).map(m => ({
        userId: m.qualifiedUserId
          ? { id: m.qualifiedUserId.id, domain: m.qualifiedUserId.domain }
          : { id: m.userId ?? '', domain: '' },
        offset: m.start,
        length: m.length,
      })),
      linkPreviews: (text.linkPreview ?? []).map(lp => ({
        url: lp.url,
        urlOffset: lp.urlOffset,
        permanentUrl: lp.permanentUrl ?? null,
        title: lp.title ?? null,
        summary: lp.summary ?? null,
        image: lp.image?.original
          ? {
              name: lp.image.original.name ?? null,
              mimeType: lp.image.original.mimeType ?? null,
              sizeInBytes: lp.image.original.size ?? null,
            }
          : null,
      })),
      quotedMessageId: text.quote?.quotedMessageId ?? null,
      quotedMessageSha256: text.quote?.quotedMessageSha256 ?? null,
      expiresAfterMillis,
    })
  } else if (ephemeral.asset) {
    const asset = ephemeral.asset
    const original = asset.original

    let metadata: AssetMetadata | null = null
    if (original?.image) {
      metadata = { type: 'image', width: original.image.width, height: original.image.height } as Image
    } else if (original?.audio) {
      metadata = {
        type: 'audio',
        durationMs: original.audio.durationInMillis ? Number(original.audio.durationInMillis) : undefined,
        normalizedLoudness: original.audio.normalizedLoudness ?? undefined,
      } as Audio
    } else if (original?.video) {
      metadata = {
        type: 'video',
        width: original.video.width ?? undefined,
        height: original.video.height ?? undefined,
        durationMs: original.video.durationInMillis ? Number(original.video.durationInMillis) : undefined,
      } as Video
    }

    let remoteData: AssetRemoteData | null = null
    if (asset.uploaded) {
      remoteData = {
        otrKey: asset.uploaded.otrKey,
        sha256: asset.uploaded.sha256,
        assetId: asset.uploaded.assetId!,
        assetDomain: asset.uploaded.assetDomain!,
        assetToken: asset.uploaded.assetToken!,
        encryptionAlgorithm: asset.uploaded.encryption as unknown as MessageEncryptionAlgorithm,
      }
    }

    return AssetMessage.create({
      conversationId: qualifiedConversation,
      metadata,
      mimeType: original?.mimeType ?? '*/*',
      name: original?.name ?? null,
      remoteData,
      sizeInBytes: original?.size ?? 0,
      expiresAfterMillis,
    })
  } else if (ephemeral.knock) {
    return KnockMessage.create({
      conversationId: qualifiedConversation,
      hotKnock: ephemeral.knock.hotKnock,
      expiresAfterMillis,
    })
  } else if (ephemeral.location) {
    return LocationMessage.create({
      conversationId: qualifiedConversation,
      longitude: ephemeral.location.longitude,
      latitude: ephemeral.location.latitude,
      name: ephemeral.location.name ?? null,
      zoom: ephemeral.location.zoom ?? null,
      expiresAfterMillis,
    })
  }

  return new Unknown()
}

function mapCompositeItems(rawItems: { button?: { text: string; id: string } | null; text?: { content: string } | null }[]): CompositeItem[] {
  return rawItems
    .map((item): CompositeItem | null => {
      if (item.button) {
        return { button: { text: item.button.text, id: item.button.id } }
      } else if (item.text) {
        return { text: { content: item.text.content } }
      }
      return null
    })
    .filter((item): item is CompositeItem => item !== null)
}

function unpackCompositeMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): CompositeMessage {
  const composite = genericMessage.composite!
  return CompositeMessage.create({
    conversationId: qualifiedConversation,
    items: mapCompositeItems(composite.items ?? []),
    expectsReadConfirmation: composite.expectsReadConfirmation ?? null,
  })
}

function unpackButtonActionMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): ButtonActionMessage {
  const action = genericMessage.buttonAction!
  return ButtonActionMessage.create({
    conversationId: qualifiedConversation,
    buttonId: action.buttonId,
    referenceMessageId: action.referenceMessageId,
  })
}

function unpackButtonActionConfirmationMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): ButtonActionConfirmationMessage {
  const confirmation = genericMessage.buttonActionConfirmation!
  return ButtonActionConfirmationMessage.create({
    conversationId: qualifiedConversation,
    referenceMessageId: confirmation.referenceMessageId,
    buttonId: confirmation.buttonId || null,
  })
}

function unpackKnockMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): KnockMessage {
  const knock = genericMessage.knock!
  return KnockMessage.create({
    conversationId: qualifiedConversation,
    hotKnock: knock.hotKnock,
  })
}

function unpackLocationMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): LocationMessage {
  const location = genericMessage.location!
  return LocationMessage.create({
    conversationId: qualifiedConversation,
    longitude: location.longitude,
    latitude: location.latitude,
    name: location.name ?? null,
    zoom: location.zoom ?? null,
  })
}

function unpackReactionMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): ReactionMessage {
  const reaction = genericMessage.reaction!
  return ReactionMessage.create({
    conversationId: qualifiedConversation,
    emoji: reaction.emoji ?? '',
    targetMessageId: reaction.messageId,
  })
}

function unpackMessageDeleteMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): MessageDeleteMessage {
  const deleted = genericMessage.deleted!
  return MessageDeleteMessage.create({
    conversationId: qualifiedConversation,
    targetMessageId: deleted.messageId,
  })
}

function unpackMessageEditMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): MessageEditMessage {
  const edited = genericMessage.edited!

  let compositeEdit: CompositeMessage | null = null
  if (edited.composite) {
    compositeEdit = CompositeMessage.create({
      conversationId: qualifiedConversation,
      items: mapCompositeItems(edited.composite.items ?? []),
      expectsReadConfirmation: edited.composite.expectsReadConfirmation ?? null,
    })
  }

  return MessageEditMessage.create({
    conversationId: qualifiedConversation,
    replacingMessageId: edited.replacingMessageId,
    text: edited.text?.content ?? null,
    composite: compositeEdit,
  })
}

function unpackConfirmationMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): ConfirmationMessage {
  const confirmation = genericMessage.confirmation!
  const confirmationType: ConfirmationType =
    confirmation.type === Confirmation.Type.READ ? 'read' : 'delivered'

  return ConfirmationMessage.create({
    conversationId: qualifiedConversation,
    confirmationType,
    firstMessageId: confirmation.firstMessageId,
    moreMessageIds: confirmation.moreMessageIds ?? [],
  })
}
