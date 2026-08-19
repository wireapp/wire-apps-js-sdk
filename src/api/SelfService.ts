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

import {singleton} from 'tsyringe'
import {SelfApiClient} from './SelfApiClient.js'
import {AppProperties} from '../service/AppProperties.js'
import {QualifiedId} from '../model/QualifiedId.js'
import {LoggerFactory} from '../utils/logger/LoggerFactory.js'
import {UnknownError} from '../exception/WireException.js'

@singleton()
export class SelfService {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  constructor(
    private selfApiClient: SelfApiClient,
    private appProperties: AppProperties
  ) {}

  async fetchAndSaveApplicationData(): Promise<QualifiedId> {
    const response = await this.selfApiClient.getSelf()
    const appUserId = new QualifiedId(response.qualified_id.id, response.qualified_id.domain)

    this.saveApplicationQualifiedId(appUserId)
    this.saveApplicationTeamId(response.team)

    return appUserId
  }

  private saveApplicationQualifiedId(appUserId: QualifiedId): void {
    if (!this.appProperties.hasApplicationQualifiedId()) {
      this.logger.info(`Saving application QualifiedId: ${appUserId}`)
      this.appProperties.saveApplicationQualifiedId(appUserId)
      return
    }

    const storedApplicationQualifiedId = this.appProperties.getApplicationQualifiedId()
    if (QualifiedId.toKey(storedApplicationQualifiedId) !== QualifiedId.toKey(appUserId)) {
      throw new UnknownError(
        `Stored application QualifiedId ${storedApplicationQualifiedId} does not match fetched self QualifiedId ${appUserId}. Clear SDK storage before using a token for another app.`
      )
    }

    this.logger.info(`Application QualifiedId already stored: ${storedApplicationQualifiedId}`)
  }

  private saveApplicationTeamId(teamId?: string): void {
    if (!this.appProperties.hasApplicationTeamId()) {
      this.logger.info(`Saving application TeamId: ${teamId}`)
      this.appProperties.saveApplicationTeamId(teamId)
      return
    }

    const storedApplicationTeamId = this.appProperties.getApplicationTeamId()
    if (storedApplicationTeamId.value !== teamId) {
      throw new UnknownError(
        `Stored application TeamId ${storedApplicationTeamId} does not match fetched self TeamId ${teamId}. Clear SDK storage before using a token for another app.`
      )
    }

    this.logger.info(`Application TeamId already stored: ${teamId}`)
  }
}
