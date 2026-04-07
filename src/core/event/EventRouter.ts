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
import {LoggerFactory} from "../../utils/logger/LoggerFactory.js";

import {injectAll, singleton} from "tsyringe";
import type {EventContentDTO} from "../../model/EventContentDTO.js";
import type {EventProcessor} from "./EventProcessor.js";
import {EVENT_PROCESSOR} from "../../utils/DependencyInjectionTokens.js";

@singleton()
export class EventRouter {
  private logger = LoggerFactory.getLogger(this.constructor.name);

  private processorMap: Map<string, EventProcessor<EventContentDTO>>;

  constructor(
    @injectAll(EVENT_PROCESSOR) processors: EventProcessor<EventContentDTO>[],
  ) {
    this.processorMap = new Map(
      processors.map(processor => [processor.eventType, processor])
    );
  }

  async route(eventResponse: EventResponse): Promise<void> {
    this.logger.debug(`Routing event:`, eventResponse.payload);

    if (!eventResponse.payload) return;

    for (const event of eventResponse.payload) {
      const processor = this.processorMap.get(event.type);

      if (processor) {
        await processor.process(event);
      } else {
        this.logger.info(`Received an unmapped event: ${event.type}`);
      }
    }
  }
}
