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
  
type Item = object
  
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
  // TODO: Add other fields
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

export interface TextMessage extends WireMessageBase, Item, Ephemeral, Replyable {
  type: 'text'
  text: string
  quotedMessageId?: string | null
  quotedMessageSha256?: (Uint8Array | null)
  mentions?: Mention[]
  linkPreviews?: LinkPreview[]
  expiresAfterMillis?: number | null
}

// Add the factory as a const with the same name
export const TextMessage = {
  create(
    params: {
      conversationId: QualifiedId
      text: string
      mentions?: Mention[]
      linkPreviews?: LinkPreview[]
      expiresAfterMillis?: number | null
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
      expiresAfterMillis: params.expiresAfterMillis ?? null
    }
  }
}

export type WireMessage =
  | Unknown
  | TextMessage;
