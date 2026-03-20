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

import type {EventResponse} from "../../api/response/EventResponse.js";
import {
  type EventContentDTO,
  isDeleteConversationEvent,
  isMemberJoinEvent,
  isMemberLeaveEvent,
  isMemberUpdateEvent,
  isMLSWelcomeEvent,
  isNewConversationEvent,
  isNewMLSMessageEvent,
  isTypingEvent
} from "../../model/EventContentDTO.js";
import {singleton} from "tsyringe";
import {LoggerFactory} from "../../utils/logger/LoggerFactory.js";
import {MlsMessageEventProcessor} from "./MlsMessageEventProcessor.js";
import {NewConversationEventProcessor} from "./NewConversationEventProcessor.js";
import {DeleteConversationEventProcessor} from "./DeleteConversationEventProcessor.js";
import {MemberJoinEventProcessor} from "./MemberJoinEventProcessor.js";
import {MemberLeaveEventProcessor} from "./MemberLeaveEventProcessor.js";
import {MemberUpdateEventProcessor} from "./MemberUpdateEventProcessor.js";
import {MlsWelcomeEventProcessor} from "./MlsWelcomeEventProcessor.js";

@singleton()
export class EventRouter {
  private logger = LoggerFactory.getLogger(this.constructor.name);

  private readonly processors: Array<[
    (event: EventContentDTO) => boolean,
    { process(event: EventContentDTO): Promise<void> }
  ]>;

  private ignoreEvent = {process: () => Promise.resolve()};

  constructor(
    mlsWelcomeEventProcessor: MlsWelcomeEventProcessor,
    mlsMessageEventProcessor: MlsMessageEventProcessor,
    newConversationEventProcessor: NewConversationEventProcessor,
    deleteConversationEventProcessor: DeleteConversationEventProcessor,
    memberJoinEventProcessor: MemberJoinEventProcessor,
    memberLeaveEventProcessor: MemberLeaveEventProcessor,
    memberUpdateEventProcessor: MemberUpdateEventProcessor,
  ) {
    this.processors = [
      [isMLSWelcomeEvent, mlsWelcomeEventProcessor],
      [isNewMLSMessageEvent, mlsMessageEventProcessor],
      [isNewConversationEvent, newConversationEventProcessor],
      [isDeleteConversationEvent, deleteConversationEventProcessor],
      [isMemberJoinEvent, memberJoinEventProcessor],
      [isMemberLeaveEvent, memberLeaveEventProcessor],
      [isMemberUpdateEvent, memberUpdateEventProcessor],
      [isTypingEvent, this.ignoreEvent],
    ];
  }

  async route(eventResponse: EventResponse): Promise<void> {
    this.logger.debug(`Routing event:`, eventResponse.payload);
    if (!eventResponse.payload) return;

    for (const event of eventResponse.payload) {
      const entry = this.processors
        .find(([guard]) => guard(event));

      if (entry) {
        await entry[1].process(event);
      } else {
        this.logger.info(`Received an unmapped event: ${(event as EventContentDTO).type}`);
      }

    }
  }

}
