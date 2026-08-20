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
import {InvalidParameterError, UnknownError} from '../exception/WireException.js'
import {TeamId} from '../model/TeamId.js'

@singleton()
export class SelfService {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  constructor(
    private selfApiClient: SelfApiClient,
    private appProperties: AppProperties
  ) {}

  async fetchAndSaveApplicationData(): Promise<void> {
    const response = await this.selfApiClient.getSelf()
    const appUserId = new QualifiedId(response.qualified_id.id, response.qualified_id.domain)

    this.saveApplicationQualifiedId(appUserId)
    this.saveApplicationTeamId(response.team)
  }

  private saveApplicationQualifiedId(appUserId: QualifiedId): void {
    if (!this.appProperties.hasApplicationQualifiedId()) {
      this.logger.info(`Saving application QualifiedId: ${appUserId}`)
      this.appProperties.saveApplicationQualifiedId(appUserId)
      return
    }

    const storedApplicationQualifiedId = this.appProperties.getApplicationQualifiedId()
    if (!QualifiedId.equals(storedApplicationQualifiedId, appUserId)) {
      throw new UnknownError(
        `Stored application QualifiedId ${storedApplicationQualifiedId} does not match fetched self QualifiedId ${appUserId}. Clear SDK storage before using a token for another app.`
      )
    }

    this.logger.info(`Application QualifiedId already stored: ${storedApplicationQualifiedId}`)
  }

  private saveApplicationTeamId(teamId?: string): void {
    if (!teamId) {
      throw new InvalidParameterError('The Application does not belong to a team')
    }

    const applicationTeamId = new TeamId(teamId)

    if (!this.appProperties.hasApplicationTeamId()) {
      this.logger.info(`Saving application TeamId: ${applicationTeamId}`)
      this.appProperties.saveApplicationTeamId(applicationTeamId.value)
      return
    }

    const storedApplicationTeamId = this.appProperties.getApplicationTeamId()
    if (storedApplicationTeamId.value !== applicationTeamId.value) {
      throw new UnknownError(
        `Stored application TeamId ${storedApplicationTeamId} does not match fetched self TeamId ${applicationTeamId}. Clear SDK storage before using a token for another app.`
      )
    }

    this.logger.info(`Application TeamId already stored: ${applicationTeamId}`)
  }
}
