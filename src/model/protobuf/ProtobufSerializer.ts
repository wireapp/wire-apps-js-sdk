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

import rootMessage, {
  type IText,
  type IGenericMessage
} from "../../generated/messages.js";
const { GenericMessage } = rootMessage;
import { type WireMessage, TextMessage } from '../WireMessage.js';

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
    linkPreview: [], // TODO: Add proper mapping for LinkPreview / LinkPreviewAsset
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
