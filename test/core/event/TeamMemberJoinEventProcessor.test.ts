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

import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {TeamMemberJoinDTO} from '../../../src/model/EventContentDTO.js'
import {TeamMemberJoinEventProcessor} from '../../../src/core/event/TeamMemberJoinEventProcessor.js'
import type {WireEventsHandler} from '../../../src/core/WireEventsHandler.js'
import type {AppProperties} from '../../../src/service/AppProperties.js'
import {QualifiedId} from '../../../src/model/QualifiedId.js'
import {TeamId} from '../../../src/model/TeamId.js'

const appQualifiedId = new QualifiedId('app-id', 'example.com')

const makeEvent = (): TeamMemberJoinDTO => ({
  type: 'team.member-join',
  team: 'team-123',
  time: new Date(),
  data: {user: 'user-1'}
})

let appProperties: AppProperties
let wireEventsHandler: WireEventsHandler
let processor: TeamMemberJoinEventProcessor

beforeEach(() => {
  vi.clearAllMocks()

  appProperties = {
    getApplicationQualifiedId: vi.fn().mockReturnValue(appQualifiedId)
  } as any

  wireEventsHandler = {
    onTeamMemberJoined: vi.fn().mockResolvedValue(undefined)
  } as any

  processor = new TeamMemberJoinEventProcessor(appProperties, wireEventsHandler)
})

describe('TeamMemberJoinEventProcessor', () => {
  describe('process', () => {
    it('should handle the team.member-join event type', () => {
      expect(processor.eventType).toBe('team.member-join')
    })

    it('should call onTeamMemberJoined with the user qualified with the application domain and the team id', async () => {
      await processor.process(makeEvent())

      expect(wireEventsHandler.onTeamMemberJoined).toHaveBeenCalledTimes(1)
      expect(wireEventsHandler.onTeamMemberJoined).toHaveBeenCalledWith(
        new QualifiedId('user-1', 'example.com'),
        new TeamId('team-123')
      )
    })

    it('should propagate errors when the application QualifiedId is missing and not call onTeamMemberJoined', async () => {
      vi.mocked(appProperties.getApplicationQualifiedId).mockImplementation(() => {
        throw new Error('No Application QualifiedId found')
      })

      await expect(processor.process(makeEvent())).rejects.toThrow('No Application QualifiedId found')
      expect(wireEventsHandler.onTeamMemberJoined).not.toHaveBeenCalled()
    })

    it('should propagate errors from onTeamMemberJoined', async () => {
      vi.mocked(wireEventsHandler.onTeamMemberJoined).mockRejectedValue(new Error('onTeamMemberJoined failed'))

      await expect(processor.process(makeEvent())).rejects.toThrow('onTeamMemberJoined failed')
    })

    it('should resolve without a value on success', async () => {
      await expect(processor.process(makeEvent())).resolves.toBeUndefined()
    })
  })
})
