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

import { QualifiedId } from "./QualifiedId.js";
import { MessageEncryptionAlgorithm } from "./protobuf/MessageEncryptionAlgorithm.js";
import Long from "long";

export type Item = object

interface Ephemeral {
  expiresAfterMillis?: number | null
}

interface Replyable {
  timestamp: Date
}

export interface Mention {
  userId: QualifiedId
  offset: number
  length: number
}

export interface LinkPreview {
  urlOffset: number
  url: string
  permanentUrl?: string | null
  title?: string | null
  summary?: string | null
  image?: LinkPreviewAsset | null
}

export interface LinkPreviewAsset {
  mimeType: string
  metadata?: AssetMetadata | null
  assetDataPath?: string | null
  assetDataSize: number | Long
  assetHeight: number
  assetWidth: number
  assetName?: string | null
  assetKey?: string | null
  assetToken?: string | null
  assetDomain?: string | null
  otrKey: Uint8Array
  sha256Key: Uint8Array
  encryptionAlgorithm: MessageEncryptionAlgorithm
}

export interface WireMessageBase {
  type: string
  id: string
  conversationId: QualifiedId
  sender: QualifiedId
  timestamp: Date
}

export class Unknown implements WireMessageBase {
  get id(): string {
    throw new Error("Unknown message, no ID")
  }

  get conversationId(): QualifiedId {
    throw new Error("Unknown message, no conversation")
  }

  get sender(): QualifiedId {
    throw new Error("Unknown message, no sender")
  }

  get timestamp(): Date {
    throw new Error("Unknown message, no timestamp")
  }

  readonly type = "unknown" as const
}

export class Ignored implements WireMessageBase {
  get id(): string {
    throw new Error("Unknown message, no ID")
  }

  get conversationId(): QualifiedId {
    throw new Error("Unknown message, no conversation")
  }

  get sender(): QualifiedId {
    throw new Error("Unknown message, no sender")
  }

  get timestamp(): Date {
    throw new Error("Unknown message, no timestamp")
  }

  readonly type = "ignored" as const
}

export interface TextMessage extends WireMessageBase, Item, Ephemeral, Replyable {
  type: 'text'
  text: string
  quotedMessageId?: string | null
  quotedMessageSha256?: Uint8Array | null
  mentions?: Mention[]
  linkPreviews?: LinkPreview[]
  expiresAfterMillis?: number | null
}

export const TextMessage = {
  create(
    params: {
      // TODO(alexandre): add messageId
      conversationId: QualifiedId
      text: string
      mentions?: Mention[]
      linkPreviews?: LinkPreview[]
      expiresAfterMillis?: number | null
    }
  ): TextMessage {
    return {
      type: 'text',
      id: crypto.randomUUID(), // TODO(alexandre): add messageId
      conversationId: params.conversationId,
      sender: new QualifiedId(crypto.randomUUID(), crypto.randomUUID()),
      text: params.text,
      mentions: params.mentions ?? [],
      linkPreviews: params.linkPreviews ?? [],
      timestamp: new Date(), // TODO(alexandre): only from replyable type
      expiresAfterMillis: params.expiresAfterMillis ?? null
    }
  }
}

export interface AssetMessage extends WireMessageBase, Ephemeral, Replyable {
  type: 'asset'
  sizeInBytes: number | Long
  name?: string | null
  mimeType: string
  metadata?: AssetMetadata | null
  remoteData?: AssetRemoteData | null
}

export const AssetMessage = {
  create(
    params: {
      conversationId: QualifiedId
      sizeInBytes: number | Long
      name?: string | null
      mimeType: string
      metadata?: AssetMetadata | null
      remoteData?: AssetRemoteData | null
      expiresAfterMillis?: number
    }
  ): AssetMessage {
    return {
      type: 'asset',
      id: crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: new QualifiedId(crypto.randomUUID(), crypto.randomUUID()),
      timestamp: new Date(), // TODO(alexandre): only from replyable type
      sizeInBytes: params.sizeInBytes,
      name: params.name ?? null,
      mimeType: params.mimeType,
      metadata: params.metadata ?? null,
      remoteData: params.remoteData ?? null,
      expiresAfterMillis: params.expiresAfterMillis ?? null
    }
  }
}

export type AssetMetadata = Image | Video | Audio

export interface Image {
  type: 'image'
  width: number
  height: number
}

export interface Video {
  type: 'video'
  width?: number
  height?: number
  durationMs?: number
}

export interface Audio {
  type: 'audio'
  durationMs?: number
  normalizedLoudness?: Uint8Array
}

export interface AssetRemoteData {
  otrKey: Uint8Array
  sha256: Uint8Array
  assetId: string
  assetToken?: string | null
  assetDomain: string
  encryptionAlgorithm?: MessageEncryptionAlgorithm | null
}

export interface CompositeButton extends Item {
  type: 'composite_button'
  id: string
  text: string
}

export const CompositeButton = {
  create(
    params: {
      text: string
      id?: string
    }
  ): CompositeButton {
    return {
      type: 'composite_button',
      id: params.id ?? crypto.randomUUID(),
      text: params.text
    }
  }
}

export interface CompositeButtonAction extends WireMessageBase {
  type: "composite_button_action"
  referenceMessageId: string
  buttonId: string
}

export const CompositeButtonAction = {
  create(
    params: {
      messageId: string
      conversationId: QualifiedId
      referenceMessageId: string
      buttonId: string
    }
  ): CompositeButtonAction {
    return {
      type: 'composite_button_action',
      id: params.messageId,
      conversationId: params.conversationId,
      buttonId: params.buttonId,
      referenceMessageId: params.referenceMessageId,
      sender: new QualifiedId(crypto.randomUUID(), crypto.randomUUID()), // TODO(alexandre): change to real sender
      timestamp: new Date(), // TODO(alexandre): only from replyable type
    }
  }
}

export interface CompositeButtonActionConfirmation extends WireMessageBase {
  type: "composite_button_action_confirmation"
  referenceMessageId: string
  buttonId: string | null
}

export const CompositeButtonActionConfirmation = {
  create(
    params: {
      messageId: string
      conversationId: QualifiedId
      referenceMessageId: string
      buttonId: string | null
    }
  ): CompositeButtonActionConfirmation {
    return {
      type: 'composite_button_action_confirmation',
      id: params.messageId,
      conversationId: params.conversationId,
      buttonId: params.buttonId,
      referenceMessageId: params.referenceMessageId,
      sender: new QualifiedId(crypto.randomUUID(), crypto.randomUUID()), // TODO(alexandre): change to real sender
      timestamp: new Date(), // TODO(alexandre): only from replyable type
    }
  }
}

export interface CompositeMessage extends WireMessageBase {
  type: "composite"
  items: Item[]
}

export const CompositeMessage = {
  create(
    params: {
      messageId?: string
      conversationId: QualifiedId
      text?: string
      itemList: Item[]
    }
  ): CompositeMessage {
    const textItem = params.text
      ? TextMessage.create({
        conversationId: params.conversationId,
        text: params.text
      })
      : null

    return {
      type: "composite",
      id: params.messageId ?? crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: new QualifiedId(crypto.randomUUID(), crypto.randomUUID()), // TODO(alexandre): change to real sender
      timestamp: new Date(), // TODO(alexandre): only from replyable type
      items: [...(textItem ? [textItem] : []), ...params.itemList]
    }
  }
}

export interface Ping extends WireMessageBase, Ephemeral {
  type: 'ping'
}

export const Ping = {
  create(
    params: {
      messageId?: string
      conversationId: QualifiedId
      expiresAfterMillis?: number | null
    }
  ): Ping {
    return {
      type: 'ping',
      id: params.messageId ?? crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: new QualifiedId(crypto.randomUUID(), crypto.randomUUID()), // TODO(alexandre): change to real sender
      timestamp: new Date(), // TODO(alexandre): only from replyable type
      expiresAfterMillis: params.expiresAfterMillis ?? null
    }
  }
}

export interface Location extends WireMessageBase, Ephemeral, Replyable {
  type: 'location'
  latitude: number
  longitude: number
  name: string | null
  zoom: number | null
}

export const Location = {
  create(
    params: {
      messageId?: string
      conversationId: QualifiedId
      latitude: number
      longitude: number
      name?: string | null | undefined
      zoom?: number | null | undefined
      expiresAfterMillis?: number | null
    }
  ): Location {
    return {
      type: 'location',
      id: params.messageId ?? crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: new QualifiedId(crypto.randomUUID(), crypto.randomUUID()), // TODO(alexandre): change to real sender
      latitude: params.latitude,
      longitude: params.longitude,
      name: params.name ?? null,
      zoom: params.zoom ?? null,
      timestamp: new Date(), // TODO(alexandre): only from replyable type
      expiresAfterMillis: params.expiresAfterMillis ?? null
    }
  }
}

export interface DeletedMessage extends WireMessageBase {
  type: 'deleted'
  messageId: string
}

export const DeletedMessage = {
  create(
    params: {
      id?: string
      conversationId: QualifiedId
      messageId: string
    }
  ): DeletedMessage {
    return {
      type: 'deleted',
      id: params.id ?? crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: new QualifiedId(crypto.randomUUID(), crypto.randomUUID()), // TODO(alexandre): change to real sender
      messageId: params.messageId,
      timestamp: new Date(), // TODO(alexandre): only from replyable type
    }
  }
}

export const ReceiptType = {
  DELIVERED: "DELIVERED",
  READ: "READ"
} as const;

export type ReceiptType = typeof ReceiptType[keyof typeof ReceiptType];

export interface Receipt extends WireMessageBase {
  type: 'receipt'
  receiptType: ReceiptType
  messageIds: string[]
}

export const Receipt = {
  create(
    params: {
      id?: string
      conversationId: QualifiedId
      receiptType: ReceiptType
      messageIds: string[]
    }
  ): Receipt {
    return {
      type: 'receipt',
      id: params.id ?? crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: new QualifiedId(crypto.randomUUID(), crypto.randomUUID()), // TODO(alexandre): change to real sender
      receiptType: params.receiptType,
      messageIds: params.messageIds,
      timestamp: new Date(), // TODO(alexandre): only from replyable type
    }
  }
}

export type WireMessage =
  | Unknown
  | Ignored
  | TextMessage
  | AssetMessage
  | CompositeButtonAction
  | CompositeButtonActionConfirmation
  | CompositeMessage
  | Ping
  | Location
  | DeletedMessage
  | Receipt;
