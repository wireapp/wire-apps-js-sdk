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

@singleton()
export class SelfService {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  constructor(
    private selfApiClient: SelfApiClient,
    private appProperties: AppProperties
  ) {}

  async fetchAndSaveSelfCredentials(): Promise<QualifiedId> {
    const response = await this.selfApiClient.getSelfQualifiedId()
    this.logger.info('Fetching self credentials')

    const applicationQualifiedId = new QualifiedId(response.id, response.domain)
    this.appProperties.saveApplicationQualifiedId(applicationQualifiedId)
    this.logger.info(`Saved Self credentials for App: ${applicationQualifiedId}`)

    return applicationQualifiedId
  }
}
