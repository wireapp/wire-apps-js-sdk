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

import type {EventResponse} from "../api/response/EventResponse.js";
import {ProtobufDeserializer} from "../mappers/protobuf/ProtobufDeserializer.js";
import {
  isMLSWelcomeEvent,
  isNewMLSMessageEvent,
  isTypingEvent,
  isNewConversationEvent,
  type EventContentDTO,
  type NewMLSMessageDTO,
  type NewConversationDTO
} from "../model/EventContentDTO.js";
import {isCoreCryptoMlsException} from "../model/exception/CoreCryptoMlsException.js";
import {isMlsException} from "../model/exception/MlsException.js";
import type {QualifiedId} from "../model/QualifiedId.js";
import {CoreCryptoService} from "./CoreCryptoService.js";
import {WireEventsHandler} from "./WireEventsHandler.js";
import {APP_CLIENT_ID, WIRE_EVENTS_HANDLER} from "../utils/DependencyInjectionTokens.js";
import {ConversationService} from "../api/ConversationService.js";
import {MlsService} from "../api/MlsService.js";
import {Decoder} from "bazinga64";
import {ConversationMapper} from "../mappers/conversation/ConversationMapper.js";
import {container, inject, singleton} from "tsyringe";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";

@singleton()
export class EventRouter {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  constructor(
    private coreCryptoService: CoreCryptoService,
    private conversationService: ConversationService,
    private mlsService: MlsService,
    @inject(WIRE_EVENTS_HANDLER) private wireEventsHandler: WireEventsHandler
  ) {
  }

  async route(eventResponse: EventResponse): Promise<void> {
    if (!eventResponse.payload) {
      return;
    }

    for (const event of eventResponse.payload) {
      if (isMLSWelcomeEvent(event)) {
        const welcomeEventInBytes = Decoder.fromBase64(event.data).asBytes
        await this.handleWelcomeEvent(
          welcomeEventInBytes,
          event.qualified_conversation
        )
      } else if (isNewMLSMessageEvent(event)) {
        const textEvent = (event as NewMLSMessageDTO)
        const mlsGroupId =
          (await this.conversationService.getConversationMLSGroupId(textEvent.qualified_conversation))

        try {
          const message = await this.coreCryptoService.decryptMls(
            mlsGroupId,
            textEvent.data
          )

          if (message == null) {
            this.logger.debug("Decryption success but no message, probably epoch update")
            return
          }

          await this.forwardMessage(
            message,
            textEvent.qualified_conversation
          )
        } catch (exception) {
          if (isMlsException(exception)) {
            this.logger.debug("Message decryption failed, MlsException:", exception)
            // TODO: Verify if convesation is out of sync
          } else if (isCoreCryptoMlsException(exception)) {
            this.logger.debug("Message decryption failed, CoreCryptoException.Mls:", exception)
            // TODO: Verify if convesation is out of sync
          } else {
            throw exception
          }
        }
      } else if (isTypingEvent(event)) {
        // Ignore silently
      } else if (isNewConversationEvent(event)) {
        const newConversationEvent = (event as NewConversationDTO)
        await this.processNewConversationEvent(newConversationEvent)
      } else {
        this.logger.info(`Received an unmapped event: ${(event as EventContentDTO).type}`)
      }
    }
  }

  private async handleWelcomeEvent(
    welcomeMessageBytes: Uint8Array,
    conversationId: QualifiedId
  ) {
    await this.coreCryptoService.processWelcomeMessage(welcomeMessageBytes)

    const conversationResponse = await this.conversationService.fetchConversationById(conversationId)
    const {conversation, members} = await this.conversationService.saveConversationWithMembers(
      conversationId,
      conversationResponse
    )

    if (await this.coreCryptoService.hasTooFewKeyPackageCount()) {
      if (container.isRegistered(APP_CLIENT_ID)) {
        const keyPackages = await this.coreCryptoService.mlsGenerateKeyPackages()
        await this.mlsService.uploadMlsKeyPackages(keyPackages)
      }
    }

    await this.wireEventsHandler.onAppAddedToConversation(
      ConversationMapper.fromEntity(conversation),
      members
    )
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
        this.logger.info("Unknown event received.")
    }
  }

  private async processNewConversationEvent(event: NewConversationDTO) {
    await this.conversationService.saveConversationWithMembers(
      event.qualified_conversation,
      event.data
    )
  }

}
