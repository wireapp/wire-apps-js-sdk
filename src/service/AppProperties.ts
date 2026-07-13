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

import {inject, singleton} from "tsyringe";
import {AppPropertiesRepository} from "../db/AppPropertiesRepository.js";
import {WIRE_CRYPTOGRAPHY_STORAGE_KEY} from "../utils/DependencyInjectionTokens.js";
import {AESUtils} from "../utils/AESUtils.js";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";

@singleton()
export class AppProperties {
  private logger = LoggerFactory.getLogger(this.constructor.name)
  private readonly SHOULD_REJOIN_CONVERSATIONS = "should_rejoin_conversations"
  private readonly LAST_NOTIFICATION_ID = "last_notification_id"
  private readonly BACKEND_COOKIE = "backend_cookie"
  private readonly DEVICE_ID = "device_id"

  constructor(
    private appPropertiesRepository: AppPropertiesRepository,
    @inject(WIRE_CRYPTOGRAPHY_STORAGE_KEY) private wireCryptoStorageKey: Uint8Array,
  ) {}

  getShouldRejoinConversations(): boolean {
    const value = this.appPropertiesRepository.getByKey(this.SHOULD_REJOIN_CONVERSATIONS)?.value
    const booleanValue = this.databaseValueToBoolean(value)

    return booleanValue ?? true
  }

  setShouldRejoinConversations(should: boolean) {
    this.appPropertiesRepository.save(
      this.SHOULD_REJOIN_CONVERSATIONS,
      this.booleanToDatabaseValue(should)
    )
  }

  getLastNotificationId(): string | undefined {
    return this.appPropertiesRepository.getByKey(this.LAST_NOTIFICATION_ID)?.value
  }

  setLastNotificationId(lastNotificationId: string) {
    this.appPropertiesRepository.save(
      this.LAST_NOTIFICATION_ID,
      lastNotificationId
    )
  }

  getBackendCookie(): string | undefined {
    const encryptedData = this.appPropertiesRepository.getByKey(this.BACKEND_COOKIE)?.value
    const key = Buffer.from(this.wireCryptoStorageKey)

    return encryptedData ? AESUtils.decryptData(Buffer.from(encryptedData, 'base64'), key).toString() : undefined
  }

  saveBackendCookie(cookie: string) {
    const key = Buffer.from(this.wireCryptoStorageKey)
    const encryptedCookie = AESUtils.encryptData(Buffer.from(cookie), key).toString('base64')
    this.appPropertiesRepository.save(this.BACKEND_COOKIE, encryptedCookie)
  }

  saveBackendCookieIfMissing(cookie: string) {
    if (!this.getBackendCookie()) {
      this.logger.info("Initializing API Token")
      this.saveBackendCookie(cookie)
    }
  }

  deleteBackendCookie() {
    this.appPropertiesRepository.delete(this.BACKEND_COOKIE)
  }

  setDeviceId(deviceId: string) {
    this.appPropertiesRepository.save(
      this.DEVICE_ID,
      deviceId
    )
  }

  getDeviceId(): string {
    const deviceId = this.appPropertiesRepository.getByKey(this.DEVICE_ID)?.value
    if (!deviceId) {
      throw new Error("No stored deviceId found")
    }

    return deviceId
  }

  hasDeviceId(): boolean {
    return !!this.appPropertiesRepository.getByKey(this.DEVICE_ID)?.value
  }

  private booleanToDatabaseValue = (value: boolean): string => value ? '1' : '0'
  private databaseValueToBoolean = (value?: string): boolean | undefined => {
    if (value === undefined) return undefined
    return value === '1'
  }
}
