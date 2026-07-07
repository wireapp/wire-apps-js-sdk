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

import {singleton} from "tsyringe"
import {HttpClient} from "../core/HttpClient.js"
import type {EventResponse} from "./response/EventResponse.js"
import type {NotificationsResponse} from "./response/NotificationsResponse.js"
import {AppProperties} from "../service/AppProperties.js"

@singleton()
export class NotificationsApiClient {
  constructor(
    private httpClient: HttpClient,
    private appProperties: AppProperties
  ) {}

  private readonly basePath = "notifications"
  private readonly lastNotificationPath = this.basePath + "/last"
  private readonly CLIENT_QUERY_KEY = "client"
  private readonly SINCE_QUERY_KEY = "since"
  private readonly SIZE_QUERY_KEY = "size"

  async getLastNotification(): Promise<EventResponse> {
    const storedDeviceId = this.appProperties.getDeviceId()
    const path = `${this.lastNotificationPath}?${this.CLIENT_QUERY_KEY}=${storedDeviceId}`

    return await this.httpClient.getRequest<EventResponse>(
      path
    )
  }

  async getPaginatedNotifications(
    querySize: number,
    querySince?: string
  ): Promise<NotificationsResponse> {
    const storedDeviceId = this.appProperties.getDeviceId()

    let path = `${this.basePath}?${this.SIZE_QUERY_KEY}=${querySize}&${this.CLIENT_QUERY_KEY}=${storedDeviceId}`
    if (querySince) {
      path = `${path}&${this.SINCE_QUERY_KEY}=${querySince}`
    }

    return await this.httpClient.getRequest<NotificationsResponse>(path)
  }
}
