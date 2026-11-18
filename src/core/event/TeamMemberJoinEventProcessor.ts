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

import {inject, injectable} from 'tsyringe'
import type {EventProcessor} from './EventProcessor.js'
import type {TeamMemberJoinDTO} from '../../model/EventContentDTO.js'
import {WireEventsHandler} from '../WireEventsHandler.js'
import {EVENT_PROCESSOR, WIRE_EVENTS_HANDLER} from '../../utils/DependencyInjectionTokens.js'
import {LoggerFactory} from '../../utils/logger/LoggerFactory.js'
import {QualifiedId} from '../../model/QualifiedId.js'
import {TeamId} from '../../model/TeamId.js'
import {AppProperties} from '../../service/AppProperties.js'

@injectable({token: EVENT_PROCESSOR})
export class TeamMemberJoinEventProcessor implements EventProcessor<TeamMemberJoinDTO> {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  readonly eventType = 'team.member-join' as const

  constructor(
    private appProperties: AppProperties,
    @inject(WIRE_EVENTS_HANDLER) private wireEventsHandler: WireEventsHandler
  ) {}

  async process(event: TeamMemberJoinDTO): Promise<void> {
    // The event only carries a non-qualified user id, team members share the application's domain
    const userId = new QualifiedId(event.data.user, this.appProperties.getApplicationQualifiedId().domain)
    const teamId = new TeamId(event.team)
    this.logger.info(`Processing TeamMemberJoin event for teamId: ${teamId}, userId: ${userId}`)

    await this.wireEventsHandler.onTeamMemberJoined(userId, teamId)

    this.logger.info(`Processed TeamMemberJoin event for teamId: ${teamId}`)
  }
}
