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

import {singleton} from "tsyringe";
import {AppPropertiesRepository} from "../db/AppPropertiesRepository.js";

@singleton()
export class AppProperties {
  private readonly SHOULD_REJOIN_CONVERSATIONS = "should_rejoin_conversations"
  private readonly LAST_NOTIFICATION_ID = "last_notification_id"

  constructor(
    private appPropertiesRepository: AppPropertiesRepository
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

  private booleanToDatabaseValue = (value: boolean): string => value ? '1' : '0'
  private databaseValueToBoolean = (value?: string): boolean | undefined => {
    if (value === undefined) return undefined
    return value === '1'
  }
}
