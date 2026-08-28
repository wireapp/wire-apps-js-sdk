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

import {inject, injectable} from 'tsyringe'
import {ProtobufDeserializer} from '../../mappers/protobuf/ProtobufDeserializer.js'
import type {EventProcessor} from './EventProcessor.js'
import type {NewMLSMessageDTO} from '../../model/EventContentDTO.js'
import {CoreCryptoService} from '../CoreCryptoService.js'
import {ConversationService} from '../../api/ConversationService.js'
import {WireEventsHandler} from '../WireEventsHandler.js'
import {EVENT_PROCESSOR, WIRE_EVENTS_HANDLER} from '../../utils/DependencyInjectionTokens.js'
import {isCoreCryptoMlsException} from '../../exception/CoreCryptoMlsException.js'
import {isMlsException} from '../../exception/MlsException.js'
import {LoggerFactory} from '../../utils/logger/LoggerFactory.js'
import {MlsFallbackStrategy} from '../../service/MlsFallbackStrategy.js'
import {QualifiedId} from '../../model/QualifiedId.js'
import {WireMessageType} from '../../model/WireMessage.js'
import type {DecryptedMlsMessage} from '../../model/DecryptedMlsMessage.js'

@injectable({token: EVENT_PROCESSOR})
export class MlsMessageEventProcessor implements EventProcessor<NewMLSMessageDTO> {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  readonly eventType = 'conversation.mls-message-add' as const

  constructor(
    private coreCryptoService: CoreCryptoService,
    private conversationService: ConversationService,
    private mlsFallbackStrategy: MlsFallbackStrategy,
    @inject(WIRE_EVENTS_HANDLER) private wireEventsHandler: WireEventsHandler
  ) {}

  async process(event: NewMLSMessageDTO): Promise<void> {
    const conversationId = new QualifiedId(event.qualified_conversation.id, event.qualified_conversation.domain)
    const mlsGroupId = await this.conversationService.getConversationMLSGroupId(conversationId)

    try {
      const decryptedMessage = await this.coreCryptoService.decryptMlsMessage(mlsGroupId, event.data)

      if (decryptedMessage == null) {
        this.logger.debug('Decryption success but no message, probably epoch update')
        return
      }

      const eventSender = new QualifiedId(event.qualified_from.id, event.qualified_from.domain)
      if (!QualifiedId.equals(decryptedMessage.sender, eventSender)) {
        this.logger.error('MLS message sender mismatch between decrypted message and backend event.', {
          decryptedSender: decryptedMessage.sender.toString(),
          eventSender: eventSender.toString()
        })
      }

      await this.forwardMessage(decryptedMessage, conversationId, event.time)
    } catch (exception) {
      if (isMlsException(exception)) {
        this.logger.warn('Message decryption failed, exception:', exception)
        await this.mlsFallbackStrategy.verifyConversationOutOfSync(mlsGroupId, conversationId)
      } else if (isCoreCryptoMlsException(exception)) {
        this.logger.warn('Message decryption failed, exception:', exception)
        await this.mlsFallbackStrategy.verifyConversationOutOfSync(mlsGroupId, conversationId)
      } else {
        throw exception
      }
    }
  }

  private async forwardMessage(
    decryptedMessage: DecryptedMlsMessage,
    conversationId: QualifiedId,
    eventTime: Date
  ): Promise<void> {
    const wireMessage = ProtobufDeserializer.toWireMessage(
      decryptedMessage.plaintext,
      conversationId,
      decryptedMessage.sender,
      eventTime
    )

    switch (wireMessage.type) {
      case WireMessageType.TEXT:
        await this.wireEventsHandler.onTextMessageReceived(wireMessage)
        break
      case WireMessageType.TEXT_EDITED:
        await this.wireEventsHandler.onTextMessageEdited(wireMessage)
        break
      case WireMessageType.ASSET:
        await this.wireEventsHandler.onAssetMessageReceived(wireMessage)
        break
      case WireMessageType.COMPOSITE_BUTTON_ACTION:
        await this.wireEventsHandler.onButtonClicked(wireMessage)
        break
      case WireMessageType.COMPOSITE_BUTTON_ACTION_CONFIRMATION:
        this.logger.debug('ButtonActionConfirmation event received.')
        break
      case WireMessageType.COMPOSITE:
        this.logger.debug('Composite event received.')
        break
      case WireMessageType.COMPOSITE_EDITED:
        this.logger.debug('CompositeEdited event received.')
        break
      case WireMessageType.PING:
        await this.wireEventsHandler.onPingReceived(wireMessage)
        break
      case WireMessageType.LOCATION:
        await this.wireEventsHandler.onLocationMessageReceived(wireMessage)
        break
      case WireMessageType.DELETED:
        await this.wireEventsHandler.onMessageDeleted(wireMessage)
        break
      case WireMessageType.RECEIPT:
        await this.wireEventsHandler.onMessageDelivered(wireMessage)
        break
      case WireMessageType.REACTION:
        await this.wireEventsHandler.onMessageReactionReceived(wireMessage)
        break
      case WireMessageType.UNKNOWN:
      default:
        this.logger.info('Unknown event received.')
    }
  }
}
