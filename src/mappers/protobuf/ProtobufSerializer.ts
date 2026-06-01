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
import type {
  IText,
  IGenericMessage,
  IAsset,
  Asset
} from "../../generated/messages.js";
const { GenericMessage } = rootMessage;
import { type WireMessage, TextMessage, AssetMessage } from '../../model/WireMessage.js';
import {MessageLinkPreviewMapper} from "./MessageLinkPreviewMapper.js";

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
    const genericMessage: Partial<IGenericMessage> = {
      messageId: wireMessage.id,
    };

    let builtMessage: IGenericMessage;

    switch (wireMessage.type) {
      case 'text':
        builtMessage = packTextMessage(wireMessage, genericMessage);
        break;

      case 'asset':
        builtMessage = packAssetMessage(wireMessage, genericMessage);
        break;

        // TODO: Add other message types here

      default:
        throw new Error(`Unsupported message type: ${(wireMessage as WireMessage).type}`);
    }

    const message = GenericMessage.create(builtMessage);
    return GenericMessage.encode(message).finish();
  },
};

/**
 * Packs a text message into the GenericMessage format
 */
function packTextMessage(
  wireMessage: TextMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  const textContent: IText = {
    content: wireMessage.text,
    // Add other text-specific fields
    mentions: wireMessage.mentions?.map(mention => ({
      qualifiedUserId: mention.userId,
      start: mention.offset,
      length: mention.length
    })) || [],
    linkPreview: wireMessage.linkPreviews
      ?.flatMap(it => {
        const mapped = MessageLinkPreviewMapper.toProtobuf(it);
        return mapped != null ? [mapped] : [];
      }) ?? [],
    expectsReadConfirmation: false,
    legalHoldStatus: null
  };

  if (wireMessage.quotedMessageId) {
    textContent.quote = {
      quotedMessageId: wireMessage.quotedMessageId!,
      ...(wireMessage.quotedMessageSha256 !== undefined ? { quotedMessageSha256: wireMessage.quotedMessageSha256 } : {})
    };
  }

  return {
    ...genericMessage,
    text: textContent,
  } as IGenericMessage;
}

function packAssetMessage(
  wireMessage: AssetMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  const original: Asset.IOriginal = {
    mimeType: wireMessage.mimeType,
    size: wireMessage.sizeInBytes,
    name: wireMessage.name ?? null
  };

  if (wireMessage.metadata) {
    if (wireMessage.metadata.type === 'image') {
      original.image = {
        width: wireMessage.metadata.width,
        height: wireMessage.metadata.height
      };
    } else if (wireMessage.metadata.type === 'audio') {
      original.audio = {};
      if (wireMessage.metadata.durationMs) {
        original.audio.durationInMillis = wireMessage.metadata.durationMs;
      }
      if (wireMessage.metadata.normalizedLoudness) {
        original.audio.normalizedLoudness = wireMessage.metadata.normalizedLoudness;
      }
    } else if (wireMessage.metadata.type === 'video') {
      original.video = {};
      if (wireMessage.metadata.width) {
        original.video.width = wireMessage.metadata.width;
      }
      if (wireMessage.metadata.height) {
        original.video.height = wireMessage.metadata.height;
      }
      if (wireMessage.metadata.durationMs) {
        original.video.durationInMillis = wireMessage.metadata.durationMs;
      }
    }
  }

  const uploaded: Asset.IRemoteData = {
    otrKey: wireMessage.remoteData?.otrKey || new Uint8Array(),
    sha256: wireMessage.remoteData?.sha256 || new Uint8Array(),
    assetId: wireMessage.remoteData?.assetId || null,
    assetToken: wireMessage.remoteData?.assetToken || null,
    assetDomain: wireMessage.remoteData?.assetDomain || null
  };

  const asset: IAsset = {
    original,
    uploaded
  };

  if (wireMessage.expiresAfterMillis !== undefined && wireMessage.expiresAfterMillis !== null) {
    return {
      ...genericMessage,
      ephemeral: {
        expireAfterMillis: wireMessage.expiresAfterMillis,
        asset
      }
    } as IGenericMessage;
  } else {
    return {
      ...genericMessage,
      asset
    } as IGenericMessage;
  }
}
