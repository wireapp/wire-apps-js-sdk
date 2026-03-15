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
import {EventRouter} from "./EventRouter.js";
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
 * Automatically reconnects with exponential backoff on unexpected disconnection.
 */
@singleton()
export class WebSocketClient {
  private logger = LoggerFactory.getLogger(this.constructor.name)
  private webSocket?: WebSocket | undefined
  private processedEventIds = new Set<string>()
  private _stopped = false
  private _reconnectAttempts = 0

  private static readonly MAX_RECONNECT_ATTEMPTS = 10
  private static readonly BASE_RECONNECT_DELAY_MS = 1_000
  private static readonly MAX_RECONNECT_DELAY_MS = 30_000

  constructor(
    @inject(WIRE_API_HOST) private wireApiHost: string,
    private httpClient: HttpClient,
    private notificationsService: NotificationsService,
    private appProperties: AppProperties,
    private eventRouter: EventRouter
  ) {}

  async connect(): Promise<void> {
    this._stopped = false
    this._reconnectAttempts = 0

    while (!this._stopped) {
      try {
        this.logger.info('Connecting')
        await this.connectWebSocket(this.buildUrl())
      } catch (exception) {
        this.logger.error('Connection error:', exception)
      }

      if (this._stopped) break

      if (this._reconnectAttempts >= WebSocketClient.MAX_RECONNECT_ATTEMPTS) {
        this.logger.error(`WebSocket stopped after ${WebSocketClient.MAX_RECONNECT_ATTEMPTS} failed reconnect attempts`)
        break
      }

      const delay = Math.min(
        WebSocketClient.BASE_RECONNECT_DELAY_MS * (2 ** this._reconnectAttempts),
        WebSocketClient.MAX_RECONNECT_DELAY_MS
      )
      this._reconnectAttempts++
      this.logger.info(`Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts}/${WebSocketClient.MAX_RECONNECT_ATTEMPTS})`)
      await new Promise<void>(r => setTimeout(r, delay))
    }

    this.logger.warn('WebSocket connection loop ended')
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

    return new Promise<void>((resolve) => {
      // Ensures onerror followed by onclose (standard WebSocket behaviour) only resolves once
      let settled = false
      const settle = () => {
        if (settled) return
        settled = true
        resolve()
      }

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
        this._reconnectAttempts = 0
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
        settle()
      }

      webSocket.onclose = () => {
        this.logger.warn("WebSocket Closed")
        settle()
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
    this._stopped = true
    if (this.webSocket) {
      this.webSocket.close()
      this.webSocket = undefined
    }
  }
}
