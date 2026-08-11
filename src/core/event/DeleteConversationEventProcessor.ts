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
import type {EventProcessor} from './EventProcessor.js'
import type {DeleteConversationDTO} from '../../model/EventContentDTO.js'
import {ConversationService} from '../../api/ConversationService.js'
import {WireEventsHandler} from '../WireEventsHandler.js'
import {EVENT_PROCESSOR, WIRE_EVENTS_HANDLER} from '../../utils/DependencyInjectionTokens.js'
import {LoggerFactory} from '../../utils/logger/LoggerFactory.js'
import {QualifiedId} from '../../model/QualifiedId.js'

@injectable({token: EVENT_PROCESSOR})
export class DeleteConversationEventProcessor implements EventProcessor<DeleteConversationDTO> {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  readonly eventType = 'conversation.delete' as const

  constructor(
    private conversationService: ConversationService,
    @inject(WIRE_EVENTS_HANDLER) private wireEventsHandler: WireEventsHandler
  ) {}

  async process(event: DeleteConversationDTO): Promise<void> {
    const conversationId = new QualifiedId(event.qualified_conversation.id, event.qualified_conversation.domain)
    this.logger.info(`Processing DeleteConversation event for conversationId: ${conversationId}`)

    await this.conversationService.deleteAllConversationDataFromLocalStorages(conversationId)
    await this.wireEventsHandler.onConversationDeleted(conversationId)

    this.logger.info(`Processed DeleteConversation event for conversationId: ${conversationId}`)
  }
}
