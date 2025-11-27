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

import { Inject, Service } from "typedi";
import type { EventResponse } from "../api/response/EventResponse.js";
import { ProtobufDeserializer } from "../mappers/protobuf/ProtobufDeserializer.js";
import { isMLSWelcomeEvent, isNewMLSMessageEvent, type EventContentDTO, type NewMLSMessageDTO } from "../model/EventContentDTO.js";
import { isCoreCryptoMlsException } from "../model/exception/CoreCryptoMlsException.js";
import { isMlsException } from "../model/exception/MlsException.js";
import type { QualifiedId } from "../model/QualifiedId.js";
import { decodeBase64Bytes } from "../utils/Base64Util.js";
import { CoreCryptoService } from "./CoreCryptoService.js";
import { WireEventsHandler } from "./WireEventsHandler.js";
import { WIRE_EVENTS_HANDLER } from "../utils/DependencyInjectionTokens.js";

@Service()
export class EventRouter {

  constructor(
    private coreCryptoService: CoreCryptoService,
    @Inject(WIRE_EVENTS_HANDLER) private wireEventsHandler: WireEventsHandler
  ) {}
  
  async route(eventResponse: EventResponse): Promise<void> {
    if (!eventResponse.payload) {
      return;
    }
    
    for (const event of eventResponse.payload) {
      if (isMLSWelcomeEvent(event)) {
        const welcome = decodeBase64Bytes(event.data)
        const groupId = await this.coreCryptoService.processWelcomeMessage(welcome)

        await this.coreCryptoService.handleJoiningConversation(
          event.qualified_conversation,
          groupId.copyBytes()
        )
      } else if (isNewMLSMessageEvent(event)) {
        const textEvent = (event as NewMLSMessageDTO)
        
        try {
          const message = await this.coreCryptoService.decryptMls(
            textEvent.qualified_conversation,
            textEvent.data
          )
          
          if (message == null) {
            console.debug("Decryption success but no message, probably epoch update")
            return
          }

          await this.forwardMessage(
            message,
            textEvent.qualified_conversation
          )
        } catch (exception) {
          if (isMlsException(exception)) {
            console.debug("Message decryption failed, MlsException:", exception)
            // TODO: Verify if convesation is out of sync
          } else if (isCoreCryptoMlsException(exception)) {
            console.debug("Message decryption failed, CoreCryptoException.Mls:", exception)
            // TODO: Verify if convesation is out of sync
          } else {
            throw exception
          }
        }
      } else {
        console.log(`[Websocket] Received an unmapped event: ${(event as EventContentDTO).type}`)
      }
    }
  }

  private async forwardMessage(
    message: Uint8Array,
    qualifiedConversation: QualifiedId
  ) {
    const wireMessage = ProtobufDeserializer.toWireMessage(
      message,
      qualifiedConversation
    )
    
    switch (wireMessage.type) {
      case 'text':
        await this.wireEventsHandler.onTextMessageReceived(wireMessage)
        break;
      
      // TODO: Add other WireMessage types
      case 'unknown':
      default:
        console.log("Unknown event received.")
    }
  }
}
