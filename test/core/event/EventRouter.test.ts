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
import {EventRouter} from '../../../src/core/event/EventRouter.js'
import type {EventResponse} from '../../../src/api/response/EventResponse.js'
import type {EventContentDTO} from '../../../src/model/EventContentDTO.js'
import type {EventProcessor} from '../../../src/core/event/EventProcessor.js'

const makeEvent = (type: string) => ({type} as any)

const makeEventResponse = (payload?: EventContentDTO[]): EventResponse => ({
  id: 'notification-id',
  transient: false,
  ...(payload !== undefined && {payload}),
})

const createProcessorMock = (eventType: string) => ({
  eventType,
  process: vi.fn().mockResolvedValue(undefined),
}) as EventProcessor<any>

let processors: EventProcessor<any>[]
let router: EventRouter

let mlsWelcomeEventProcessor: EventProcessor<any>
let mlsMessageEventProcessor: EventProcessor<any>
let mlsResetEventProcessor: EventProcessor<any>
let newConversationEventProcessor: EventProcessor<any>
let deleteConversationEventProcessor: EventProcessor<any>
let memberJoinEventProcessor: EventProcessor<any>
let memberLeaveEventProcessor: EventProcessor<any>
let memberUpdateEventProcessor: EventProcessor<any>
let typingEventProcessor: EventProcessor<any>

beforeEach(() => {
  vi.clearAllMocks()

  mlsWelcomeEventProcessor = createProcessorMock('conversation.mls-welcome')
  mlsMessageEventProcessor = createProcessorMock('conversation.mls-message-add')
  mlsResetEventProcessor = createProcessorMock('conversation.mls-reset')
  newConversationEventProcessor = createProcessorMock('conversation.create')
  deleteConversationEventProcessor = createProcessorMock('conversation.delete')
  memberJoinEventProcessor = createProcessorMock('conversation.member-join')
  memberLeaveEventProcessor = createProcessorMock('conversation.member-leave')
  memberUpdateEventProcessor = createProcessorMock('conversation.member-update')

  typingEventProcessor = createProcessorMock('conversation.typing')

  processors = [
    mlsWelcomeEventProcessor,
    mlsMessageEventProcessor,
    mlsResetEventProcessor,
    newConversationEventProcessor,
    deleteConversationEventProcessor,
    memberJoinEventProcessor,
    memberLeaveEventProcessor,
    memberUpdateEventProcessor,
    typingEventProcessor,
  ]

  router = new EventRouter(processors)
})

describe('EventRouter', () => {
  describe('route', () => {

    it('should do nothing when payload is undefined', async () => {
      await router.route(makeEventResponse())

      processors.forEach(p => {
        expect(p.process).not.toHaveBeenCalled()
      })
    })

    it('should do nothing when payload is empty', async () => {
      await router.route(makeEventResponse([]))

      processors.forEach(p => {
        expect(p.process).not.toHaveBeenCalled()
      })
    })

    it('should route events to correct processors', async () => {
      const event = makeEvent('conversation.mls-welcome')

      await router.route(makeEventResponse([event]))

      expect(mlsWelcomeEventProcessor.process).toHaveBeenCalledWith(event)
    })

    it('should not route unknown event types', async () => {
      await router.route(makeEventResponse([makeEvent('conversation.unknown-event')]))

      processors.forEach(p => {
        expect(p.process).not.toHaveBeenCalled()
      })
    })

    it('should route multiple events correctly', async () => {
      const welcome = makeEvent('conversation.mls-welcome')
      const memberJoin = makeEvent('conversation.member-join')
      const newConversation = makeEvent('conversation.create')

      await router.route(makeEventResponse([welcome, memberJoin, newConversation]))

      expect(mlsWelcomeEventProcessor.process).toHaveBeenCalledWith(welcome)
      expect(memberJoinEventProcessor.process).toHaveBeenCalledWith(memberJoin)
      expect(newConversationEventProcessor.process).toHaveBeenCalledWith(newConversation)
    })

    it('should route mls-reset events to the MlsResetEventProcessor', async () => {
      const event = makeEvent('conversation.mls-reset')

      await router.route(makeEventResponse([event]))

      expect(mlsResetEventProcessor.process).toHaveBeenCalledWith(event)
    })

    it('should process events sequentially', async () => {
      const callOrder: string[] = []

      vi.mocked(mlsWelcomeEventProcessor.process).mockImplementation(async () => {
        callOrder.push('mls-welcome')
      })

      vi.mocked(memberJoinEventProcessor.process).mockImplementation(async () => {
        callOrder.push('member-join')
      })

      await router.route(makeEventResponse([
        makeEvent('conversation.mls-welcome'),
        makeEvent('conversation.member-join'),
      ]))

      expect(callOrder).toEqual(['mls-welcome', 'member-join'])
    })

    it('should resolve without a value', async () => {
      await expect(
        router.route(makeEventResponse([makeEvent('conversation.create')]))
      ).resolves.toBeUndefined()
    })

    it('should call typing processor (no longer ignored by router)', async () => {
      const event = makeEvent('conversation.typing')

      await router.route(makeEventResponse([event]))

      expect(typingEventProcessor.process).toHaveBeenCalledWith(event)
    })

  })
})
