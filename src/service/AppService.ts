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
import {AppRepository} from "../db/AppRepository.js";

@singleton()
export class AppService {
  private readonly SHOULD_REJOIN_CONVERSATIONS = "should_rejoin_conversations"

  constructor(
    private appRepository: AppRepository
  ) {}

  getShouldRejoinConversations(): boolean | undefined {
    return this.databaseValueToBoolean(
      this.appRepository.getByKey(this.SHOULD_REJOIN_CONVERSATIONS)?.value
    )
  }

  setShouldRejoinConversations(should: boolean) {
    this.appRepository.save(
      this.SHOULD_REJOIN_CONVERSATIONS,
      this.booleanToDatabaseValue(should)
    )
  }

  private booleanToDatabaseValue = (value?: boolean): string => value ? '1' : '0'
  private databaseValueToBoolean = (value?: string): boolean => value === '1'
}
