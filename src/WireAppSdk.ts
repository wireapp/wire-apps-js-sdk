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
// import 'fake-indexeddb/auto';
import {CoreCryptoService} from "./core/CoreCryptoService.js";
import {
  WIRE_API_HOST,
  WIRE_CRYPTO_STORAGE_PASSWORD,
  WIRE_DATABASE_PATH,
  WIRE_EVENTS_HANDLER,
  WIRE_USER_DOMAIN,
  WIRE_USER_EMAIL,
  WIRE_USER_ID,
  WIRE_USER_PASSWORD
} from "./utils/DependencyInjectionTokens.js";
import {WebSocketClient} from "./core/WebSocketClient.js";
import {WireEventsHandler} from "./core/WireEventsHandler.js";
import {DatabaseService} from "./db/DatabaseService.js";
import {container} from "tsyringe";
import type {Logger} from "./utils/logger/Logger.js";
import {LoggerFactory} from "./utils/logger/LoggerFactory.js";
import {ConsoleLogger} from "./utils/logger/ConsoleLogger.js";
import {ConversationService} from "./api/ConversationService.js";
import {setupIndexedDatabase} from "./setup-indexeddb.js";

export class WireAppSdk {
  private userEmail: string
  private userPassword: string
  private userId: string
  private userDomain: string
  private apiHost: string
  private cryptographyStoragePassword: string

  private isShuttingDown = false

  private isWebSocketRunning: boolean = false
  private webSocketClient!: WebSocketClient
  private conversationService!: ConversationService

  private wireEventsHandler: WireEventsHandler
  private logger: Logger

  private constructor(
    userEmail: string,
    userPassword: string,
    userId: string,
    userDomain: string,
    apiHost: string,
    cryptographyStoragePassword: string,
    wireEventsHandler: WireEventsHandler,
    logger?: Logger
  ) {
    this.userEmail = userEmail
    this.userPassword = userPassword
    this.userId = userId
    this.userDomain = userDomain
    this.apiHost = apiHost
    this.cryptographyStoragePassword = cryptographyStoragePassword
    this.wireEventsHandler = wireEventsHandler
    LoggerFactory.setRootLogger(logger ?? new ConsoleLogger())
    this.logger = LoggerFactory.getLogger(this.constructor.name)
  }

  static async create(
    userEmail: string,
    userPassword: string,
    userId: string,
    userDomain: string,
    apiHost: string,
    cryptographyStoragePassword: string,
    wireEventsHandler: WireEventsHandler,
    logger?: Logger,
  ): Promise<WireAppSdk> {
    const wireAppSdk = new WireAppSdk(
      userEmail,
      userPassword,
      userId,
      userDomain,
      apiHost,
      cryptographyStoragePassword,
      wireEventsHandler,
      logger
    )

    wireAppSdk.registerExitHandlers()
    await wireAppSdk.init()

    return wireAppSdk
  }

  private async init() {
    setupIndexedDatabase()
    this.configureDependencies()
    await this.initCryptoClient()
  }

  private configureDependencies() {
    container.registerInstance(WIRE_API_HOST, this.apiHost)
    container.registerInstance(WIRE_USER_EMAIL, this.userEmail)
    container.registerInstance(WIRE_USER_PASSWORD, this.userPassword)
    container.registerInstance(WIRE_USER_ID, this.userId)
    container.registerInstance(WIRE_USER_DOMAIN, this.userDomain)
    container.registerInstance(WIRE_CRYPTO_STORAGE_PASSWORD, this.cryptographyStoragePassword)
    container.registerInstance(WIRE_DATABASE_PATH, DatabaseService.DEFAULT_DATABASE_PATH)

    container.registerInstance(WIRE_EVENTS_HANDLER, this.wireEventsHandler)
    this.webSocketClient = container.resolve(WebSocketClient)
    this.conversationService = container.resolve(ConversationService)
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

    this.webSocketClient.connect()

    await this.conversationService.establishOrRejoinConversations()
  }

  stopListening() {
    if (!this.isWebSocketRunning) {
      this.logger.info("Wire Apps SDK is not running.")
    }
    this.logger.info("Wire Apps SDK shutting down.")
    this.isWebSocketRunning = false

    this.webSocketClient.close()
  }

  async close() {
    this.logger.debug("Closing Websocket connections.")
    this.stopListening()

    this.logger.debug("Closing CoreCrypto connections.")
    const coreCryptoService = container.resolve(CoreCryptoService)
    await coreCryptoService.close()

    this.logger.debug("Closing Database connections.")
    const databaseService = container.resolve(DatabaseService)
    databaseService.close()

    // Clear container to prevent memory leaks
    container.clearInstances()
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
    } catch (error) {
      this.logger.error('Error during cleanup:', error)
      process.exit(1)
    }
  }
}
