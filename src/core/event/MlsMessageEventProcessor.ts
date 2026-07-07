/*
 * Wire
 * Copyright (C) 2026 Wire Swiss GmbH
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

import {inject, injectable} from "tsyringe";
import {ProtobufDeserializer} from "../../mappers/protobuf/ProtobufDeserializer.js";
import type {EventProcessor} from "./EventProcessor.js";
import type {NewMLSMessageDTO} from "../../model/EventContentDTO.js";
import {CoreCryptoService} from "../CoreCryptoService.js";
import {ConversationService} from "../../api/ConversationService.js";
import {WireEventsHandler} from "../WireEventsHandler.js";
import {EVENT_PROCESSOR, WIRE_EVENTS_HANDLER} from "../../utils/DependencyInjectionTokens.js";
import {isCoreCryptoMlsException} from "../../model/exception/CoreCryptoMlsException.js";
import {isMlsException} from "../../model/exception/MlsException.js";
import {LoggerFactory} from "../../utils/logger/LoggerFactory.js";
import {MlsFallbackStrategy} from "../../service/MlsFallbackStrategy.js";
import {QualifiedId} from "../../model/QualifiedId.js";

@injectable({token: EVENT_PROCESSOR})
export class MlsMessageEventProcessor implements EventProcessor<NewMLSMessageDTO> {
  private logger = LoggerFactory.getLogger(this.constructor.name);

  readonly eventType = "conversation.mls-message-add" as const;

  constructor(
    private coreCryptoService: CoreCryptoService,
    private conversationService: ConversationService,
    private mlsFallbackStrategy: MlsFallbackStrategy,
    @inject(WIRE_EVENTS_HANDLER) private wireEventsHandler: WireEventsHandler
  ) {
  }

  async process(event: NewMLSMessageDTO): Promise<void> {
    const conversationId = new QualifiedId(event.qualified_conversation.id, event.qualified_conversation.domain)
    const mlsGroupId = await this.conversationService.getConversationMLSGroupId(conversationId);

    try {
      const message = await this.coreCryptoService.decryptMls(mlsGroupId, event.data);

      if (message == null) {
        this.logger.debug("Decryption success but no message, probably epoch update");
        return;
      }

      await this.forwardMessage(message, event);
    } catch (exception) {
      if (isMlsException(exception)) {
        this.logger.warn("Message decryption failed, exception:", exception);
        await this.mlsFallbackStrategy.verifyConversationOutOfSync(mlsGroupId, conversationId);
      } else if (isCoreCryptoMlsException(exception)) {
        this.logger.warn("Message decryption failed, exception:", exception);
        await this.mlsFallbackStrategy.verifyConversationOutOfSync(mlsGroupId, conversationId);
      } else {
        throw exception;
      }
    }
  }

  private async forwardMessage(message: Uint8Array, event: NewMLSMessageDTO): Promise<void> {
    const conversationId = new QualifiedId(event.qualified_conversation.id, event.qualified_conversation.domain)
    const senderId = new QualifiedId(event.qualified_from.id, event.qualified_from.domain)
    const wireMessage = ProtobufDeserializer.toWireMessage(
      message,
      conversationId,
      senderId,
      event.time
    )

    switch (wireMessage.type) {
      case 'text':
        await this.wireEventsHandler.onTextMessageReceived(wireMessage)
        break
      case 'text-edited':
        await this.wireEventsHandler.onTextEditedMessageReceived(wireMessage)
        break
      case 'asset':
        await this.wireEventsHandler.onAssetMessageReceived(wireMessage)
        break
      case 'composite_button_action':
        await this.wireEventsHandler.onButtonClicked(wireMessage)
        break
      case 'composite_button_action_confirmation':
        this.logger.debug('ButtonActionConfirmation event received.')
        break
      case 'composite':
        this.logger.debug('Composite event received.')
        break
      case 'ping':
        await this.wireEventsHandler.onPingReceived(wireMessage)
        break
      case 'location':
        await this.wireEventsHandler.onLocationReceived(wireMessage)
        break
      case 'deleted':
        await this.wireEventsHandler.onMessageDeleted(wireMessage)
        break
      case 'receipt':
        await this.wireEventsHandler.onMessageDelivered(wireMessage)
        break
      case 'reaction':
        await this.wireEventsHandler.onMessageReactionReceived(wireMessage)
        break
      case 'unknown':
      default:
        this.logger.info("Unknown event received.")
    }
  }
}
