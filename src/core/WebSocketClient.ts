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

import { Container } from "typedi";
import { HttpClient } from "./HttpClient.js";
import { randomUUID } from "crypto";
import { APP_CLIENT_ID, WIRE_API_HOST, WIRE_EVENTS_HANDLER } from "../utils/DependencyInjectionTokens.js";
import { WebSocket as NodeWebSocket } from "ws";
import type { ConsumableNotificationResponse } from "../api/response/ConsumableNotificationResponse.js";
import type { EventNotification } from "../model/notification/EventNotification.js";
import type { MissedNotification } from "../model/notification/MissedNotification.js";
import type { SynchronizationNotification } from "../model/notification/SynchronizationNotification.js";
import { EventAcknowledgeRequest } from "../api/request/EventAcknowledgeRequest.js";
import type { EventContentDTO } from "../model/EventContentDTO.js";
import type { NewMLSMessageDTO } from "../model/mls/NewMLSMessageDTO.js";
import type { MlsException } from "../model/exception/MlsException.js";
import type { CoreCryptoMlsException } from "../model/exception/CoreCryptoMlsException.js";
import type { EventResponse } from "../api/response/EventResponse.js";
import type { ConversationService } from "../api/ConversationService.js";
import { decodeBase64Bytes } from "../utils/Base64Util.js";
import type { CoreCryptoClient } from "./CoreCryptoClient.js";
import { AppClientId } from "../model/AppClientId.js";
import type { QualifiedId } from "../model/QualifiedId.js";
import type { MlsService } from "../api/MlsService.js";
import type { MLSWelcomeDTO } from "../model/mls/MLSWelcomeDTO.js";
import type { MLSGroupId } from "../model/mls/MLSGroupId.js";
import { ProtobufDeserializer } from "../model/protobuf/ProtobufDeserializer.js";
import type { WireEventsHandler } from "./WireEventsHandler.js";
import type { ConversationResponse } from "../api/response/ConversationResponse.js";

const WebSocketImpl = (globalThis.WebSocket ?? NodeWebSocket) as typeof WebSocket;

export class WebSocketClient {
  private httpClient: HttpClient
  private coreCryptoClient: CoreCryptoClient
  private conversationService: ConversationService
  private mlsService: MlsService
  private webSocket?: InstanceType<typeof WebSocketImpl> | undefined
  private syncMarker?: string | null
  private wireEventsHandler: WireEventsHandler

  constructor(
    httpClient: HttpClient,
    coreCryptoClient: CoreCryptoClient,
    conversationService: ConversationService,
    mlsService: MlsService
  ) {
    this.httpClient = httpClient
    this.coreCryptoClient = coreCryptoClient
    this.conversationService = conversationService
    this.mlsService = mlsService

    this.wireEventsHandler = Container.get<WireEventsHandler>(WIRE_EVENTS_HANDLER)
  }

  async connect(): Promise<void> {
    this.syncMarker = randomUUID()

    try {
      const webSocketUrl = this.buildUrl()
      console.info(`[WebSocket] Connecting`)

      await this.connectWebSocket(webSocketUrl)
    } catch (err) {
      console.error("[WebSocket] Error connecting:", err)
      throw err
    } finally {
      console.warn("[WebSocket] Connection closed, stopping event listener")
    }
  }

  private buildUrl(): string {
    const baseUrl = Container.get<string>(WIRE_API_HOST)
    const webSocketBaseUrl = baseUrl
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
        console.info("[WebSocket] Connected")
      }

      webSocket.onmessage = async (event: MessageEvent) => {
        if (Buffer.isBuffer(event.data)) {
          await this.handleEvent(event.data)
        } else {
          console.error("[WebSocket] Unsupported frame type:", typeof event.data)
        }
      }

      webSocket.onerror = (error) => {
        console.error("[WebSocket] Error:", error)
        reject(error)
      }

      webSocket.onclose = () => {
        console.warn("[WebSocket] Closed")
        resolve()
      }
    })
  }

  private async handleEventNotification(notification: EventNotification) {
    console.log("[WebSocket] Received EventNotification")
    try {
      await this.route(notification.data.event);
      const ackRequest = EventAcknowledgeRequest.basicAck(notification.data.delivery_tag);
      this.ackEvent(ackRequest);
    } catch (exception) {
      console.error("Error processing event:", notification, exception);
    }
  }

  private async handleMissedNotification() {
    console.warn("[WebSocket] App was offline for too long, missed some notifications")
    const ackRequest = EventAcknowledgeRequest.notificationMissedAck();
    this.ackEvent(ackRequest);
  }

  private async handleSyncNotification(notification: SynchronizationNotification) {
    if ((notification as SynchronizationNotification).data.delivery_tag) {
      const ackRequest = EventAcknowledgeRequest.basicAck((notification as SynchronizationNotification).data.delivery_tag);
      this.ackEvent(ackRequest);
    }
    
    if ((notification as SynchronizationNotification).data.marker_id === this.syncMarker) {
      console.info("Notifications are up to date since last sync marker.");
    } else {
      console.info(
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
      console.error("Error handling event:", exception);
    }
  }

  private async route(eventResponse: EventResponse): Promise<void> {
    if (!eventResponse.payload) {
      return;
    }
    
    for (const event of eventResponse.payload) {
      if (this.isMLSWelcomeEvent(event)) {
        const welcome = decodeBase64Bytes(event.data)
        const groupId = await this.coreCryptoClient.processWelcomeMessage(welcome)

        await this.handleJoiningConversation(
          event.qualified_conversation,
          groupId.copyBytes()
        )
      } else if (this.isNewMLSMessageEvent(event)) {
        const textEvent = (event as NewMLSMessageDTO)
        
        try {
          const message = await this.coreCryptoClient.decryptMls(
            textEvent.qualified_conversation,
            textEvent.data
          )
          
          if (message == null) {
            console.debug("Decryption success but no message, probably epoch update")
            return
          }

          await this.forwardMessage(
            message,
            textEvent.qualified_conversation
          )
        } catch (exception) {
          if (this.isMlsException(exception)) {
            console.debug("Message decryption failed, MlsException:", exception)
            // TODO: Verify if convesation is out of sync
          } else if (this.isCoreCryptoMlsException(exception)) {
            console.debug("Message decryption failed, CoreCryptoException.Mls:", exception)
            // TODO: Verify if convesation is out of sync
          } else {
            throw exception
          }
        }
      } else {
        console.log(`[Websocket] Received an unmapped event: ${(event as EventContentDTO).type}`)
      }
    }
  }

  private async forwardMessage(
    message: Uint8Array,
    qualifiedConversation: QualifiedId
  ) {
    const wireMessage = ProtobufDeserializer.toWireMessage(
      message,
      qualifiedConversation
    )
    
    switch (wireMessage.type) {
      case 'text':
        await this.wireEventsHandler.onTextMessageReceived(wireMessage)
        break;
      
      // TODO: Add other WireMessage types
      case 'unknown':
      default:
        console.log("Unknown event received.")
    }
  }

  private async handleJoiningConversation(
    qualifiedConversation: QualifiedId,
    groupId: MLSGroupId | null
  ): Promise<MLSGroupId> {
    const conversation = await this.conversationService.getConversation(qualifiedConversation)
    const mlsGroupId = groupId ?? this.getDecodedMlsGroupId(conversation)
    
    // TODO: Save Conversation to storage
    
    if (await this.coreCryptoClient.hasTooFewKeyPackageCount()) {
      // TODO: Change getAppClientId to appStorage/DB request
      const appClientId = Container.get<AppClientId>(APP_CLIENT_ID)
      if (appClientId) {
        const keyPackages = await this.coreCryptoClient.mlsGenerateKeyPackages()
        await this.mlsService.uploadMlsKeyPackages(keyPackages)
      }
    }
    
    return mlsGroupId
  }

  private getDecodedMlsGroupId(conversation: ConversationResponse): MLSGroupId {
    if (!conversation.groupId) {
      // TODO: Map to WireException
      throw new Error("MLSGroupId should not be empty or null.")
    }
    
    const decodedBytes = decodeBase64Bytes(conversation.groupId)
    return decodedBytes
  }

  private ackEvent(ackRequest: EventAcknowledgeRequest): boolean {
    try {
      const json = JSON.stringify(ackRequest)
      
      if (!this.webSocket) {
        console.error("Failed to send acknowledge event: WebSocket not initialized", json)
        return false
      }
      
      if (this.webSocket.readyState !== WebSocketImpl.OPEN) {
        console.error(`Failed to send acknowledge event: WebSocket state is ${this.webSocket.readyState}`, json)
        return false
      }
      
      this.webSocket.send(json)
      console.debug("Acknowledge event sent successfully", json)
      return true
    } catch (error) {
      console.error("Failed to send acknowledge event", ackRequest, error)
      return false
    }
  }

  close() {
    if (this.webSocket) {
      this.webSocket.close()
      this.webSocket = undefined
    }
  }

  // TOOD: Probably move each to its own event/exception file
  private isNewMLSMessageEvent(event: EventContentDTO): event is NewMLSMessageDTO {
    return (event as NewMLSMessageDTO).type === "conversation.mls-message-add"
  }

  private isMLSWelcomeEvent(event: EventContentDTO): event is MLSWelcomeDTO {
    return (event as MLSWelcomeDTO).type === "conversation.mls-welcome"
  }

  private isMlsException(error: unknown): error is MlsException {
    return error instanceof Error && error.name === 'MlsException';
  }

  private isCoreCryptoMlsException(error: unknown): error is CoreCryptoMlsException {
    return error instanceof Error && error.name === 'CoreCryptoMlsException';
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