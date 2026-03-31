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

import {singleton} from "tsyringe";
import type {EventProcessor} from "./EventProcessor.js";
import type {NewConversationDTO} from "../../model/EventContentDTO.js";
import {ConversationService} from "../../api/ConversationService.js";
import {LoggerFactory} from "../../utils/logger/LoggerFactory.js";
import {obfuscateId} from "../../utils/ObfuscateUtil.js";

@singleton()
export class NewConversationEventProcessor implements EventProcessor<NewConversationDTO> {
  private logger = LoggerFactory.getLogger(this.constructor.name);

  readonly eventType = "conversation.create" as const;

  constructor(private conversationService: ConversationService) {
  }

  async process(event: NewConversationDTO): Promise<void> {
    this.logger.info(`Processing NewConversation event for conversationId: ${obfuscateId(event.qualified_conversation.id)}`);

    await this.conversationService.saveConversationWithMembers(event.qualified_conversation, event.data);

    this.logger.info(`Processed NewConversation event for conversationId: ${obfuscateId(event.qualified_conversation.id)}`);
  }
}
