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
import { CoreCryptoService } from "./core/CoreCryptoService.js";
import 'fake-indexeddb/auto';
import { WIRE_API_HOST, WIRE_CRYPTO_STORAGE_PASSWORD, WIRE_DATABASE_PATH, WIRE_EVENTS_HANDLER, WIRE_USER_DOMAIN, WIRE_USER_EMAIL, WIRE_USER_ID, WIRE_USER_PASSWORD } from "./utils/DependencyInjectionTokens.js";
import { WebSocketClient } from "./core/WebSocketClient.js";
import { WireEventsHandler } from "./core/WireEventsHandler.js";
import { DatabaseService } from "./db/DatabaseService.js";
import { container } from "tsyringe";
import type {Logger} from "./utils/logger/Logger.js";
import {DefaultLogger} from "./utils/logger/DefaultLogger.js";

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
    logger: Logger
  ) {
    this.userEmail = userEmail
    this.userPassword = userPassword
    this.userId = userId
    this.userDomain = userDomain
    this.apiHost = apiHost
    this.cryptographyStoragePassword = cryptographyStoragePassword
    this.wireEventsHandler = wireEventsHandler
    this.logger = logger || new DefaultLogger() // TODO: Maybe we don't need to set default logger ?
  }

  static async create(
    userEmail: string,
    userPassword: string,
    userId: string,
    userDomain: string,
    apiHost: string,
    cryptographyStoragePassword: string,
    wireEventsHandler: WireEventsHandler,
    logger: Logger,
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
  }

  private async initCryptoClient() {
    const coreCryptoService = container.resolve(CoreCryptoService)
    await coreCryptoService.initCoreCryptoClient()
    await coreCryptoService.initOrRegisterClient()

    console.log(`CoreCrypto initialized.`)
    this.logger.info(`---> LOGGER  ------> CoreCrypto initialized.`)
  }

  async startListening() {
    if (this.isWebSocketRunning) {
      console.info("Wire Apps SDK is already running.")
      return
    }
    this.isWebSocketRunning = true

    await this.webSocketClient.connect()
  }

  stopListening() {
    if (!this.isWebSocketRunning) {
      console.info("Wire Apps SDK is not running.")
    }
    console.info("Wire Apps SDK shutting down.")
    this.isWebSocketRunning = false

    this.webSocketClient.close()
  }

  async close() {
    console.debug("Closing Websocket connections.")
    this.stopListening()

    console.debug("Closing CoreCrypto connections.")
    const coreCryptoService = container.resolve(CoreCryptoService)
    await coreCryptoService.close()

    console.debug("Closing Database connections.")
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
      console.error('Uncaught exception:', error)
      this.handleExit('uncaughtException')
    })

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection:', reason)
      this.handleExit('unhandledRejection')
    })
  }

  private async handleExit(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    this.isShuttingDown = true
    console.log(`Received ${signal}, cleaning up...`)

    try {
      await this.close()
      console.log('Cleanup completed successfully')
      process.exit(0)
    } catch (error) {
      console.error('Error during cleanup:', error)
      process.exit(1)
    }
  }
}
