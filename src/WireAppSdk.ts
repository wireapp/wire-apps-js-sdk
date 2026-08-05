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

import "reflect-metadata";
import './core/event/processors.index.js'
import {mkdirSync} from "node:fs";
import {CoreCryptoService} from "./core/CoreCryptoService.js";
import {
  WIRE_API_HOST,
  WIRE_CRYPTOGRAPHY_STORAGE_KEY,
  WIRE_EVENTS_HANDLER,
  WIRE_USER_DOMAIN,
  WIRE_USER_ID,
  WIRE_SDK_API_TOKEN
} from "./utils/DependencyInjectionTokens.js";
import {WebSocketClient} from "./core/WebSocketClient.js";
import {WireEventsHandler} from "./core/WireEventsHandler.js";
import {DatabaseService} from "./db/DatabaseService.js";
import {container} from "tsyringe";
import type {Logger} from "./utils/logger/Logger.js";
import {LoggerFactory} from "./utils/logger/LoggerFactory.js";
import {ConsoleLogger} from "./utils/logger/ConsoleLogger.js";
import {ConversationService} from "./api/ConversationService.js";
import {AppProperties} from "./service/AppProperties.js";
import {CRYPTOGRAPHY_STORAGE_PATH, STORAGE_PATH} from "./utils/StoragePaths.js";
import type {BackendConnectionListener} from "./core/BackendConnectionListener.js";

export class WireAppSdk {
  private readonly CRYPTOGRAPHY_STORAGE_KEY_BYTES = 32
  private userId: string
  private apiToken: string
  private userDomain: string
  private apiHost: string
  private cryptographyStorageKey: Uint8Array

  private isShuttingDown = false

  private isWebSocketRunning: boolean = false
  private webSocketClient?: WebSocketClient
  private conversationService?: ConversationService
  private appProperties?: AppProperties

  private wireEventsHandler: WireEventsHandler
  private backendConnectionListener?: BackendConnectionListener
  private logger: Logger

  private constructor(
    userId: string,
    apiToken: string,
    userDomain: string,
    apiHost: string,
    cryptographyStorageKey: Uint8Array,
    wireEventsHandler: WireEventsHandler,
    logger?: Logger
  ) {
    if (cryptographyStorageKey.length !== this.CRYPTOGRAPHY_STORAGE_KEY_BYTES) {
      throw new Error(
        `cryptographyStorageKey must be exactly ${this.CRYPTOGRAPHY_STORAGE_KEY_BYTES} bytes long`
      );
    }


    this.userId = userId
    this.apiToken = apiToken
    this.userDomain = userDomain
    this.apiHost = apiHost
    this.cryptographyStorageKey = cryptographyStorageKey
    this.wireEventsHandler = wireEventsHandler
    LoggerFactory.setRootLogger(logger ?? new ConsoleLogger())
    this.logger = LoggerFactory.getLogger(this.constructor.name)
  }

  static async create(
    userId: string,
    apiToken: string,
    userDomain: string,
    apiHost: string,
    cryptographyStorageKey: Uint8Array,
    wireEventsHandler: WireEventsHandler,
    logger?: Logger,
  ): Promise<WireAppSdk> {
    const wireAppSdk = new WireAppSdk(
      userId,
      apiToken,
      userDomain,
      apiHost,
      cryptographyStorageKey,
      wireEventsHandler,
      logger
    )

    wireAppSdk.registerExitHandlers()
    await wireAppSdk.init()
    return wireAppSdk
  }

  private async init() {
    this.prepareStorage()
    this.configureDependencies()
    // Save cookie from constructor parameter only at first application start.
    // Once BE provides new token, the one stored in `apiToken` will be obsolete.
    this.appProperties!.saveBackendCookieIfMissing(this.apiToken)

    await this.initCryptoClient()
  }

  private prepareStorage() {
    mkdirSync(STORAGE_PATH, {recursive: true})
    mkdirSync(CRYPTOGRAPHY_STORAGE_PATH, {recursive: true})
  }

  private configureDependencies() {
    container.registerInstance(WIRE_API_HOST, this.apiHost)
    container.registerInstance(WIRE_SDK_API_TOKEN, this.apiToken)
    container.registerInstance(WIRE_USER_ID, this.userId)
    container.registerInstance(WIRE_USER_DOMAIN, this.userDomain)
    container.registerInstance(WIRE_CRYPTOGRAPHY_STORAGE_KEY, this.cryptographyStorageKey)

    container.registerInstance(WIRE_EVENTS_HANDLER, this.wireEventsHandler)

    this.webSocketClient = container.resolve(WebSocketClient)
    this.conversationService = container.resolve(ConversationService)
    this.appProperties = container.resolve(AppProperties)

    if (this.backendConnectionListener) {
      this.webSocketClient.setBackendConnectionListener(this.backendConnectionListener)
    }
  }

  private async initCryptoClient() {
    const coreCryptoService = container.resolve(CoreCryptoService)
    await coreCryptoService.initCoreCryptoClient()
    await coreCryptoService.initOrRegisterClient()

    this.logger.info(`CoreCrypto initialized.`)
  }

  async startListening() {
    if (this.isWebSocketRunning) {
      this.logger.info("Wire Apps SDK is already running.")
      return
    }
    this.isWebSocketRunning = true

    if (!this.webSocketClient || !this.conversationService) {
      throw new Error("Wire Apps SDK dependencies are not initialized.")
    }

    this.webSocketClient.connect().finally(() => {
      this.isWebSocketRunning = false
    })

    await this.conversationService.establishOrRejoinConversations()
  }

  stopListening() {
    if (!this.isWebSocketRunning) {
      this.logger.info("Wire Apps SDK is not running.")
    }
    this.logger.info("Wire Apps SDK shutting down.")
    this.isWebSocketRunning = false

    this.webSocketClient?.close()
  }

  async close() {
    this.logger.debug("Closing Websocket connections.")
    this.stopListening()

    this.logger.debug("Closing Database connections.")
    try {
      const databaseService = container.resolve(DatabaseService)
      databaseService.close()
    } catch (exception) {
      this.logger.debug("Database service was not initialized or could not be closed.", exception)
    }

    // Clear container to prevent memory leaks
    container.clearInstances()
  }

  /**
   * Registers a listener to be notified when the connection to the Wire backend
   * is established or lost.
   */
  setBackendConnectionListener(listener: BackendConnectionListener): void {
    this.backendConnectionListener = listener
    this.webSocketClient?.setBackendConnectionListener(listener)
  }

  private registerExitHandlers(): void {
    // SIGINT: Ctrl+C in terminal
    process.on('SIGINT', () => this.handleExit('SIGINT'))

    // SIGTERM: Termination signal (e.g., from Docker, Kubernetes)
    process.on('SIGTERM', () => this.handleExit('SIGTERM'))

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error)
      this.handleExit('uncaughtException')
    })

    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled rejection:', reason)
      this.handleExit('unhandledRejection')
    })
  }

  private async handleExit(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    this.isShuttingDown = true
    this.logger.info(`Received ${signal}, cleaning up...`)

    try {
      await this.close()
      this.logger.info('Cleanup completed successfully')
      process.exit(0)
    } catch (exception) {
      this.logger.error('Error during cleanup:', exception)
      process.exit(1)
    }
  }
}
