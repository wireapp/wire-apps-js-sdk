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

import type { QualifiedId } from "./QualifiedId.js";
import { MessageEncryptionAlgorithm } from "./protobuf/MessageEncryptionAlgorithm.js";
import Long from "long";

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
  url: string
  urlOffset: number
  permanentUrl?: string | null
  title?: string | null
  summary?: string | null
  image?: LinkPreviewAsset | null
}

interface LinkPreviewAsset {
  name?: string | null
  mimeType?: string | null
  sizeInBytes?: number | Long | null
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

export interface TextMessage extends WireMessageBase, Ephemeral, Replyable {
  type: 'text'
  text: string
  quotedMessageId?: string | null
  quotedMessageSha256?: (Uint8Array | null)
  mentions?: Mention[]
  linkPreviews?: LinkPreview[]
  expiresAfterMillis?: number | null
}

export const TextMessage = {
  create(
    params: {
      conversationId: QualifiedId
      text: string
      mentions?: Mention[]
      linkPreviews?: LinkPreview[]
      expiresAfterMillis?: number | null
      quotedMessageId?: string | null
      quotedMessageSha256?: Uint8Array | null
    }
  ): TextMessage {
    return {
      type: 'text',
      id: crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: {
        id: crypto.randomUUID(),
        domain: crypto.randomUUID(),
      },
      text: params.text,
      mentions: params.mentions ?? [],
      linkPreviews: params.linkPreviews ?? [],
      timestamp: new Date(),
      expiresAfterMillis: params.expiresAfterMillis ?? null,
      quotedMessageId: params.quotedMessageId ?? null,
      quotedMessageSha256: params.quotedMessageSha256 ?? null,
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
      sender: {
        id: crypto.randomUUID(),
        domain: crypto.randomUUID(),
      },
      timestamp: new Date(),
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

// ============================================================
// Composite / UI Component Messages
// ============================================================

/**
 * A button within a Composite message. The `id` is used to identify which
 * button the user pressed when sending a ButtonAction.
 */
export interface Button {
  text: string
  id: string
}

/**
 * A single item within a Composite message. Exactly one of `text` or `button`
 * is present, matching the proto `oneof content` constraint.
 */
export type CompositeItem =
  | { text: { content: string }; button?: never }
  | { button: Button; text?: never }

/**
 * A Composite message is an interactive UI card that can contain a mix of
 * text paragraphs and tappable buttons. Bots send these to render in-chat
 * interactive experiences.
 */
export interface CompositeMessage extends WireMessageBase {
  type: 'composite'
  items: CompositeItem[]
  expectsReadConfirmation?: boolean | null
}

export const CompositeMessage = {
  create(
    params: {
      conversationId: QualifiedId
      items: CompositeItem[]
      expectsReadConfirmation?: boolean | null
    }
  ): CompositeMessage {
    return {
      type: 'composite',
      id: crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: {
        id: crypto.randomUUID(),
        domain: crypto.randomUUID(),
      },
      timestamp: new Date(),
      items: params.items,
      expectsReadConfirmation: params.expectsReadConfirmation ?? null,
    }
  }
}

/**
 * Sent by a client when the user taps a button in a Composite message.
 */
export interface ButtonActionMessage extends WireMessageBase {
  type: 'buttonAction'
  buttonId: string
  referenceMessageId: string
}

export const ButtonActionMessage = {
  create(
    params: {
      conversationId: QualifiedId
      buttonId: string
      referenceMessageId: string
    }
  ): ButtonActionMessage {
    return {
      type: 'buttonAction',
      id: crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: {
        id: crypto.randomUUID(),
        domain: crypto.randomUUID(),
      },
      timestamp: new Date(),
      buttonId: params.buttonId,
      referenceMessageId: params.referenceMessageId,
    }
  }
}

/**
 * Sent by a bot to confirm which button was pressed (or that no button is
 * accepted) in response to a ButtonAction.
 */
export interface ButtonActionConfirmationMessage extends WireMessageBase {
  type: 'buttonActionConfirmation'
  referenceMessageId: string
  /** The confirmed button ID. If absent, no button is accepted. */
  buttonId?: string | null
}

export const ButtonActionConfirmationMessage = {
  create(
    params: {
      conversationId: QualifiedId
      referenceMessageId: string
      buttonId?: string | null
    }
  ): ButtonActionConfirmationMessage {
    return {
      type: 'buttonActionConfirmation',
      id: crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: {
        id: crypto.randomUUID(),
        domain: crypto.randomUUID(),
      },
      timestamp: new Date(),
      referenceMessageId: params.referenceMessageId,
      buttonId: params.buttonId ?? null,
    }
  }
}

// ============================================================
// Other Message Types
// ============================================================

/** A knock/ping message to get attention in a conversation. */
export interface KnockMessage extends WireMessageBase, Ephemeral {
  type: 'knock'
  hotKnock: boolean
}

export const KnockMessage = {
  create(
    params: {
      conversationId: QualifiedId
      hotKnock?: boolean
      expiresAfterMillis?: number | null
    }
  ): KnockMessage {
    return {
      type: 'knock',
      id: crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: {
        id: crypto.randomUUID(),
        domain: crypto.randomUUID(),
      },
      timestamp: new Date(),
      hotKnock: params.hotKnock ?? false,
      expiresAfterMillis: params.expiresAfterMillis ?? null,
    }
  }
}

/** A geographical location message. */
export interface LocationMessage extends WireMessageBase, Ephemeral {
  type: 'location'
  longitude: number
  latitude: number
  name?: string | null
  zoom?: number | null
}

export const LocationMessage = {
  create(
    params: {
      conversationId: QualifiedId
      longitude: number
      latitude: number
      name?: string | null
      zoom?: number | null
      expiresAfterMillis?: number | null
    }
  ): LocationMessage {
    return {
      type: 'location',
      id: crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: {
        id: crypto.randomUUID(),
        domain: crypto.randomUUID(),
      },
      timestamp: new Date(),
      longitude: params.longitude,
      latitude: params.latitude,
      name: params.name ?? null,
      zoom: params.zoom ?? null,
      expiresAfterMillis: params.expiresAfterMillis ?? null,
    }
  }
}

/** An emoji reaction to an existing message. An empty `emoji` removes the reaction. */
export interface ReactionMessage extends WireMessageBase {
  type: 'reaction'
  /** The emoji string, or an empty string to remove all reactions. */
  emoji: string
  targetMessageId: string
}

export const ReactionMessage = {
  create(
    params: {
      conversationId: QualifiedId
      emoji: string
      targetMessageId: string
    }
  ): ReactionMessage {
    return {
      type: 'reaction',
      id: crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: {
        id: crypto.randomUUID(),
        domain: crypto.randomUUID(),
      },
      timestamp: new Date(),
      emoji: params.emoji,
      targetMessageId: params.targetMessageId,
    }
  }
}

/** Requests that a message be deleted for all participants. */
export interface MessageDeleteMessage extends WireMessageBase {
  type: 'messageDelete'
  targetMessageId: string
}

export const MessageDeleteMessage = {
  create(
    params: {
      conversationId: QualifiedId
      targetMessageId: string
    }
  ): MessageDeleteMessage {
    return {
      type: 'messageDelete',
      id: crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: {
        id: crypto.randomUUID(),
        domain: crypto.randomUUID(),
      },
      timestamp: new Date(),
      targetMessageId: params.targetMessageId,
    }
  }
}

/** Replaces the content of an existing text or composite message. */
export interface MessageEditMessage extends WireMessageBase {
  type: 'messageEdit'
  replacingMessageId: string
  /** Updated text content (mutually exclusive with `composite`). */
  text?: string | null
  /** Updated composite content (mutually exclusive with `text`). */
  composite?: CompositeMessage | null
}

export const MessageEditMessage = {
  create(
    params: {
      conversationId: QualifiedId
      replacingMessageId: string
      text?: string | null
      composite?: CompositeMessage | null
    }
  ): MessageEditMessage {
    return {
      type: 'messageEdit',
      id: crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: {
        id: crypto.randomUUID(),
        domain: crypto.randomUUID(),
      },
      timestamp: new Date(),
      replacingMessageId: params.replacingMessageId,
      text: params.text ?? null,
      composite: params.composite ?? null,
    }
  }
}

export type ConfirmationType = 'delivered' | 'read'

/** A delivery or read receipt for one or more messages. */
export interface ConfirmationMessage extends WireMessageBase {
  type: 'confirmation'
  confirmationType: ConfirmationType
  firstMessageId: string
  moreMessageIds?: string[]
}

export const ConfirmationMessage = {
  create(
    params: {
      conversationId: QualifiedId
      confirmationType: ConfirmationType
      firstMessageId: string
      moreMessageIds?: string[]
    }
  ): ConfirmationMessage {
    return {
      type: 'confirmation',
      id: crypto.randomUUID(),
      conversationId: params.conversationId,
      sender: {
        id: crypto.randomUUID(),
        domain: crypto.randomUUID(),
      },
      timestamp: new Date(),
      confirmationType: params.confirmationType,
      firstMessageId: params.firstMessageId,
      moreMessageIds: params.moreMessageIds ?? [],
    }
  }
}

export type WireMessage =
  | Unknown
  | TextMessage
  | AssetMessage
  | CompositeMessage
  | ButtonActionMessage
  | ButtonActionConfirmationMessage
  | KnockMessage
  | LocationMessage
  | ReactionMessage
  | MessageDeleteMessage
  | MessageEditMessage
  | ConfirmationMessage;
