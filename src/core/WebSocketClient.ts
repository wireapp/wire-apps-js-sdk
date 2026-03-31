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

import {HttpClient} from "./HttpClient.js";
import {WIRE_API_HOST} from "../utils/DependencyInjectionTokens.js";
import {WebSocket as NodeWebSocket} from "ws";
import {EventRouter} from "./event/EventRouter.js";
import {inject, singleton} from "tsyringe";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import type {EventResponse} from "../api/response/EventResponse.js";
import {NotificationsService} from "../service/NotificationsService.js";
import {AppProperties} from "../service/AppProperties.js";

const getWebSocketImpl = (): typeof WebSocket => (globalThis.WebSocket ?? NodeWebSocket) as typeof WebSocket;

/**
 * Handles the WebSocket connection to the backend.
 *
 * Receives binary events and routes them to the appropriate handlers.
 */
@singleton()
export class WebSocketClient {
  private logger = LoggerFactory.getLogger(this.constructor.name)
  private webSocket?: WebSocket | undefined
  private processedEventIds = new Set<string>()

  constructor(
    @inject(WIRE_API_HOST) private wireApiHost: string,
    private httpClient: HttpClient,
    private notificationsService: NotificationsService,
    private appProperties: AppProperties,
    private eventRouter: EventRouter
  ) {}

  async connect(): Promise<void> {
    try {
      const webSocketUrl = this.buildUrl()
      this.logger.info(`Connecting`)

      await this.connectWebSocket(webSocketUrl)
    } catch (exception) {
      this.logger.error("Error connecting:", exception)
      throw exception
    } finally {
      this.logger.warn("Connection closed, stopping event listener")
    }
  }

  private buildUrl(): string {
    const webSocketBaseUrl = this.wireApiHost
      .replace(/^https/, "wss")
      .replace(/-https/, "-ssl")

    const url = new URL(`${webSocketBaseUrl}/await`)
    url.searchParams.append("client", this.httpClient.getCachedDeviceId())
    url.searchParams.append("access_token", this.httpClient.getCachedAccessToken())

    return url.toString()
  }

  private async connectWebSocket(webSocketUrl: string): Promise<void> {
    const webSocket = new (getWebSocketImpl())(webSocketUrl)
    this.webSocket = webSocket

    return new Promise((resolve, reject) => {
      const messageBuffer: MessageEvent[] = []
      let isSyncing = true

      const processMessage = async (event: MessageEvent) => {
        if (event.data instanceof Blob ||
          event.data instanceof ArrayBuffer ||
          event.data instanceof Uint8Array ||
          Buffer.isBuffer(event.data)) {

          let buffer: Buffer
          if (event.data instanceof Blob) {
            const arrayBuffer = await event.data.arrayBuffer()
            buffer = Buffer.from(arrayBuffer)
          } else if (Buffer.isBuffer(event.data)) {
            buffer = event.data
          } else if (event.data instanceof ArrayBuffer) {
            buffer = Buffer.from(event.data)
          } else {
            buffer = Buffer.from(event.data)
          }

          await this.handleEvent(buffer)
        } else {
          this.logger.error("Unsupported frame type:", typeof event.data)
        }
      }

      webSocket.onopen = async () => {
        this.logger.info("Websocket Connected")

        try {
          await this.syncMissedNotifications();
        } catch (error) {
          this.logger.error("Failed to sync missed notifications:", error)
        }

        isSyncing = false

        for (const bufferedMsg of messageBuffer) {
          await processMessage(bufferedMsg)
        }
        this.logger.info("Sync of missed notifications completed")
        messageBuffer.length = 0
      }

      webSocket.onmessage = async (event: MessageEvent) => {
        if (isSyncing) {
          messageBuffer.push(event)
        } else {
          await processMessage(event)
        }
      }

      webSocket.onerror = (error) => {
        this.logger.error("Websocket Error:", error)
        reject(error)
      }

      webSocket.onclose = () => {
        this.logger.warn("WebSocket Closed")
        resolve()
      }
    })
  }

  private async handleEvent(data: Buffer) {
    const jsonString = data.toString('utf-8');
    const event = JSON.parse(jsonString) as EventResponse;

    try {
      if (!event.transient && !this.processedEventIds.has(event.id)) {
        this.processedEventIds.clear()
        await this.eventRouter.route(event)
        this.appProperties.setLastNotificationId(event.id)

        // TODO: Send back ACK event (To be done when we have Async notifications again)
      }
    } catch (exception) {
      this.logger.error(`Error processing event: ${event}`, exception)
    }
  }

  /**
   * Fetches and syncs missed notifications while the SDK was offline.
   */
  private async syncMissedNotifications() {
    let lastNotificationId = await this.notificationsService.getLastNotificationId()

    let hasMore = true
    while (hasMore) {
      const notificationsResponse = await this.notificationsService.getPaginatedNotifications(lastNotificationId)

      for (const notification of notificationsResponse.notifications) {
        try {
          await this.eventRouter.route(notification)
          this.processedEventIds.add(notification.id)
        } catch (exception) {
          this.logger.error(`Failed to process notification: ${notification.id}`, exception)
        }
      }

      const lastNotification = notificationsResponse.notifications.at(-1)
      if (lastNotification) {
        lastNotificationId = lastNotification.id
        this.appProperties.setLastNotificationId(lastNotificationId)
      }

      hasMore = notificationsResponse.has_more
    }
  }

  close() {
    if (this.webSocket) {
      this.webSocket.close()
      this.webSocket = undefined
    }
  }
}
