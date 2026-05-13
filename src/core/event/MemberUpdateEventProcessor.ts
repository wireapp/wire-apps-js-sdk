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

import {injectable} from "tsyringe";
import type {EventProcessor} from "./EventProcessor.js";
import type {MemberUpdateDTO} from "../../model/EventContentDTO.js";
import {ConversationService} from "../../api/ConversationService.js";
import {LoggerFactory} from "../../utils/logger/LoggerFactory.js";
import {QualifiedId} from "../../model/QualifiedId.js";
import {EVENT_PROCESSOR} from "../../utils/DependencyInjectionTokens.js";

@injectable({token: EVENT_PROCESSOR})
export class MemberUpdateEventProcessor implements EventProcessor<MemberUpdateDTO> {
  private logger = LoggerFactory.getLogger(this.constructor.name);

  readonly eventType = "conversation.member-update" as const;

  constructor(private conversationService: ConversationService) {
  }

  async process(event: MemberUpdateDTO): Promise<void> {
    const qualifiedConversationId = new QualifiedId(event.qualified_conversation.id, event.qualified_conversation.domain);
    const qualifiedUserId = new QualifiedId(event.data.qualified_target.id, event.data.qualified_target.domain);

    this.logger.info(`Processing MemberUpdate event for conversationId: ${qualifiedConversationId}`);

    await this.conversationService.syncMemberUpdate(qualifiedUserId, qualifiedConversationId, event.data.conversation_role);

    this.logger.info(`Processed MemberUpdate event for conversationId: ${qualifiedConversationId}`);
  }
}
