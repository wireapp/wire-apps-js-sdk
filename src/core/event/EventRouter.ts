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
  type DeleteConversationDTO,
  type EventContentDTO,
  type MemberJoinDTO,
  type MemberLeaveDTO,
  type MemberUpdateDTO,
  type MLSWelcomeDTO,
  type NewConversationDTO,
  type NewMLSMessageDTO,
  type TypingDTO
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
      [EventRouter.isMLSWelcomeEvent, mlsWelcomeEventProcessor],
      [EventRouter.isNewMLSMessageEvent, mlsMessageEventProcessor],
      [EventRouter.isNewConversationEvent, newConversationEventProcessor],
      [EventRouter.isDeleteConversationEvent, deleteConversationEventProcessor],
      [EventRouter.isMemberJoinEvent, memberJoinEventProcessor],
      [EventRouter.isMemberLeaveEvent, memberLeaveEventProcessor],
      [EventRouter.isMemberUpdateEvent, memberUpdateEventProcessor],
      [EventRouter.isTypingEvent, this.ignoreEvent],
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

  private static isNewMLSMessageEvent(event: EventContentDTO): event is NewMLSMessageDTO {
    return event.type === "conversation.mls-message-add"
  }

  private static isMLSWelcomeEvent(event: EventContentDTO): event is MLSWelcomeDTO {
    return event.type === "conversation.mls-welcome"
  }

  private static isNewConversationEvent(event: EventContentDTO): event is NewConversationDTO {
    return event.type === "conversation.create"
  }

  private static isDeleteConversationEvent(event: EventContentDTO): event is DeleteConversationDTO {
    return event.type === "conversation.delete"
  }

  private static isTypingEvent(event: EventContentDTO): event is TypingDTO {
    return event.type === "conversation.typing"
  }

  private static isMemberJoinEvent(event: EventContentDTO): event is MemberJoinDTO {
    return event.type === "conversation.member-join"
  }

  private static isMemberLeaveEvent(event: EventContentDTO): event is MemberLeaveDTO {
    return event.type === "conversation.member-leave"
  }

  private static isMemberUpdateEvent(event: EventContentDTO): event is MemberUpdateDTO {
    return event.type === "conversation.member-update"
  }
}
