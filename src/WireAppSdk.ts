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
import { Container } from "typedi"
import { CoreCryptoService } from "./core/CoreCryptoService.js";
import 'fake-indexeddb/auto';
import { WIRE_API_HOST, WIRE_CRYPTO_STORAGE_PASSWORD, WIRE_EVENTS_HANDLER, WIRE_USER_DOMAIN, WIRE_USER_EMAIL, WIRE_USER_ID, WIRE_USER_PASSWORD } from "./utils/DependencyInjectionTokens.js";
import { WebSocketClient } from "./core/WebSocketClient.js";
import { WireEventsHandler } from "./core/WireEventsHandler.js";

export class WireAppSdk {
  private userEmail: string
  private userPassword: string
  private userId: string
  private userDomain: string
  private apiHost: string
  private cryptographyStoragePassword: string

  private isWebSocketRunning: boolean = false
  private webSocketClient!: WebSocketClient

  private wireEventsHandler: WireEventsHandler

  private constructor(
    userEmail: string,
    userPassword: string,
    userId: string,
    userDomain: string,
    apiHost: string,
    cryptographyStoragePassword: string,
    wireEventsHandler: WireEventsHandler
  ) {
    this.userEmail = userEmail
    this.userPassword = userPassword
    this.userId = userId
    this.userDomain = userDomain
    this.apiHost = apiHost
    this.cryptographyStoragePassword = cryptographyStoragePassword
    this.wireEventsHandler = wireEventsHandler
  }

  static async create(
    userEmail: string,
    userPassword: string,
    userId: string,
    userDomain: string,
    apiHost: string,
    cryptographyStoragePassword: string,
    wireEventsHandler: WireEventsHandler
  ): Promise<WireAppSdk> {
    const wireAppSdk = new WireAppSdk(
      userEmail,
      userPassword,
      userId,
      userDomain,
      apiHost,
      cryptographyStoragePassword,
      wireEventsHandler
    )

    await wireAppSdk.init()

    return wireAppSdk
  }

  private async init() {
    this.configureDependencies()
    await this.initCryptoClient()
  }

  private configureDependencies() {
    Container.set(WIRE_API_HOST, this.apiHost)
    Container.set(WIRE_USER_EMAIL, this.userEmail)
    Container.set(WIRE_USER_PASSWORD, this.userPassword)
    Container.set(WIRE_USER_ID, this.userId)
    Container.set(WIRE_USER_DOMAIN, this.userDomain)
    Container.set(WIRE_CRYPTO_STORAGE_PASSWORD, this.cryptographyStoragePassword)

    Container.set(WIRE_EVENTS_HANDLER, this.wireEventsHandler)
    this.webSocketClient = Container.get(WebSocketClient)
  }

  private async initCryptoClient() {
    const coreCryptoService = Container.get(CoreCryptoService)
    await coreCryptoService.initCoreCryptoClient()
    await coreCryptoService.initOrRegisterClient()

    console.log(`CoreCrypto initialized.`)
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
}
