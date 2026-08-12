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
import type {QualifiedId} from '../model/QualifiedId.js'

@singleton()
export class SelfService {
  constructor(
    private selfApiClient: SelfApiClient,
    private appProperties: AppProperties
  ) {}

  async fetchAndSaveSelfCredentials(): Promise<QualifiedId> {
    const applicationQualifiedId = await this.selfApiClient.getSelfQualifiedId()

    this.appProperties.saveApplicationQualifiedId(applicationQualifiedId)
    return applicationQualifiedId
  }
}
