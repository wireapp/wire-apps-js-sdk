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

import { HttpClient } from "./HttpClient.js";
import { randomUUID } from "crypto";
import { WIRE_API_HOST } from "../utils/DependencyInjectionTokens.js";
import { WebSocket as NodeWebSocket } from "ws";
import type { ConsumableNotificationResponse } from "../api/response/ConsumableNotificationResponse.js";
import type { EventNotification } from "../model/notification/EventNotification.js";
import type { MissedNotification } from "../model/notification/MissedNotification.js";
import type { SynchronizationNotification } from "../model/notification/SynchronizationNotification.js";
import { EventAcknowledgeRequest } from "../api/request/EventAcknowledgeRequest.js";
import { EventRouter } from "./EventRouter.js";
import { inject, singleton } from "tsyringe";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";

const WebSocketImpl = (globalThis.WebSocket ?? NodeWebSocket) as typeof WebSocket;

/**
 * Handles the WebSocket connection to the backend.
 *
 * Receives binary events and routes them to the appropriate handlers.
 */
@singleton()
export class WebSocketClient {
  private logger = LoggerFactory.getLogger(this.constructor.name)
  private webSocket?: InstanceType<typeof WebSocketImpl> | undefined
  private syncMarker?: string | null

  constructor(
    @inject(WIRE_API_HOST) private wireApiHost: string,
    private httpClient: HttpClient,
    private eventRouter: EventRouter
  ) {}

  async connect(): Promise<void> {
    this.syncMarker = randomUUID()

    try {
      const webSocketUrl = this.buildUrl()
      this.logger.info(`[WebSocket] Connecting`)

      await this.connectWebSocket(webSocketUrl)
    } catch (err) {
      this.logger.error("[WebSocket] Error connecting:", err)
      throw err
    } finally {
      this.logger.warn("[WebSocket] Connection closed, stopping event listener")
    }
  }

  private buildUrl(): string {
    const webSocketBaseUrl = this.wireApiHost
      .replace(/^https/, "wss")
      .replace(/-https/, "-ssl")

    const url = new URL(`${webSocketBaseUrl}/${this.httpClient.getApiHostVersion()}/events`)
    url.searchParams.append("client", this.httpClient.getCachedDeviceId())
    url.searchParams.append("access_token", this.httpClient.getCachedAccessToken())
    url.searchParams.append("sync_marker", this.syncMarker!)

    return url.toString()
  }

  private async connectWebSocket(webSocketUrl: string): Promise<void> {
    const webSocket = new WebSocketImpl(webSocketUrl)
    this.webSocket = webSocket

    return new Promise((resolve, reject) => {
      webSocket.onopen = () => {
        this.logger.info("[WebSocket] Connected")
      }

      webSocket.onmessage = async (event: MessageEvent) => {
        if (event.data instanceof Blob ||
          event.data instanceof ArrayBuffer ||
          event.data instanceof Uint8Array ||
          Buffer.isBuffer(event.data)) {

          let buffer: Buffer;
          if (event.data instanceof Blob) {
            const arrayBuffer = await event.data.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
          } else if (Buffer.isBuffer(event.data)) {
            buffer = event.data;
          } else if (event.data instanceof ArrayBuffer) {
            buffer = Buffer.from(event.data);
          } else {
            buffer = Buffer.from(event.data);
          }

          await this.handleEvent(buffer);
        } else {
          this.logger.error("[WebSocket] Unsupported frame type:", typeof event.data)
          return
        }
      }

      webSocket.onerror = (error) => {
        this.logger.error("[WebSocket] Error:", error)
        reject(error)
      }

      webSocket.onclose = () => {
        this.logger.warn("[WebSocket] Closed")
        resolve()
      }
    })
  }

  private async handleEventNotification(notification: EventNotification) {
    this.logger.info("[WebSocket] Received EventNotification")
    try {
      await this.eventRouter.route(notification.data.event);
      const ackRequest = EventAcknowledgeRequest.basicAck(notification.data.delivery_tag);
      this.ackEvent(ackRequest);
    } catch (exception) {
      this.logger.error("Error processing event:", notification, exception);
    }
  }

  private async handleMissedNotification() {
    this.logger.warn("[WebSocket] App was offline for too long, missed some notifications")
    const ackRequest = EventAcknowledgeRequest.notificationMissedAck();
    this.ackEvent(ackRequest);
  }

  private async handleSyncNotification(notification: SynchronizationNotification) {
    if ((notification as SynchronizationNotification).data.delivery_tag) {
      const ackRequest = EventAcknowledgeRequest.basicAck((notification as SynchronizationNotification).data.delivery_tag);
      this.ackEvent(ackRequest);
    }

    if ((notification as SynchronizationNotification).data.marker_id === this.syncMarker) {
      this.logger.info("Notifications are up to date since last sync marker.");
    } else {
      this.logger.info(
        `Skipping sync marker [${(notification as SynchronizationNotification).data.marker_id}], ` +
        `as it is not valid for this session.`
      );
    }
  }

  private async handleEvent(data: Buffer) {
    try {
      const jsonString = data.toString('utf-8');

      const notification = JSON.parse(jsonString) as ConsumableNotificationResponse;

      if (this.isEventNotification(notification)) {
        await this.handleEventNotification(notification)
      } else if (this.isMissedNotification(notification)) {
        await this.handleMissedNotification()
      } else if (this.isSynchronizationNotification(notification)) {
        await this.handleSyncNotification(notification)
      }
    } catch (exception) {
      this.logger.error("Error handling event:", exception);
    }
  }

  private ackEvent(ackRequest: EventAcknowledgeRequest): boolean {
    try {
      const json = JSON.stringify(ackRequest)

      if (!this.webSocket) {
        this.logger.error("Failed to send acknowledge event: WebSocket not initialized", json)
        return false
      }

      if (this.webSocket.readyState !== WebSocketImpl.OPEN) {
        this.logger.error(`Failed to send acknowledge event: WebSocket state is ${this.webSocket.readyState}`, json)
        return false
      }

      this.webSocket.send(json)
      this.logger.debug("Acknowledge event sent successfully", json)
      return true
    } catch (error) {
      this.logger.error("Failed to send acknowledge event", ackRequest, error)
      return false
    }
  }

  close() {
    if (this.webSocket) {
      this.webSocket.close()
      this.webSocket = undefined
    }
  }

  private isEventNotification(notification: ConsumableNotificationResponse): notification is EventNotification {
    return notification.type === "event"
  }

  private isMissedNotification(notification: ConsumableNotificationResponse): notification is MissedNotification {
    return notification.type === "notifications_missed"
  }

  private isSynchronizationNotification(notification: ConsumableNotificationResponse): notification is SynchronizationNotification {
    return notification.type === "synchronization"
  }
}
