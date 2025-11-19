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
import type { QualifiedId } from "../QualifiedId.js";
const { GenericMessage } = rootMessage;
import { type WireMessage, TextMessage, Unknown } from '../WireMessage.js';

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
    
    if (genericMessage.text) {
      return unpackTextMessage(genericMessage, qualifiedConversation)
    } else {
      return new Unknown()
    }
  }
}

function unpackTextMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): TextMessage {
  return TextMessage.create({
    conversationId: qualifiedConversation,
    text: genericMessage.text!.content
    // TODO: Map other fields
  })
}
