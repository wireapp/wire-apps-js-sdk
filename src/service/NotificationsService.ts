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
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import {NotificationsApiClient} from "../api/NotificationsApiClient.js";
import type {EventResponse} from "../api/response/EventResponse.js";
import type {NotificationsResponse} from "../api/response/NotificationsResponse.js";
import {AppProperties} from "./AppProperties.js";

@singleton()
export class NotificationsService {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  private readonly NOTIFICATION_MINIMUM_QUERY_SIZE = 100

  constructor(
    private notificationsApiClient: NotificationsApiClient,
    private appProperties: AppProperties
  ) {}

  async getLastNotificationId(): Promise<string> {
    const cached = this.appProperties.getLastNotificationId()
    if (cached != null) return cached
  
    const lastNotificationEvent = await this.getLastNotification()
    this.appProperties.setLastNotificationId(lastNotificationEvent.id)
    return lastNotificationEvent.id
  }

  private async getLastNotification(): Promise<EventResponse> {
    this.logger.info(`Getting last notification`)
    return await this.notificationsApiClient.getLastNotification()
  }

  async getPaginatedNotifications(querySince?: string): Promise<NotificationsResponse> {
    this.logger.info(`Getting paginated notifications since ${querySince}`)
    try {
      return await this.notificationsApiClient.getPaginatedNotifications(
        this.NOTIFICATION_MINIMUM_QUERY_SIZE,
        querySince
      )
    } catch (exception) {
      this.logger.warn("Notifications not found", exception)
      return {
        has_more: false,
        notifications: [],
        time: new Date()
      } as NotificationsResponse
    }
  }
}
