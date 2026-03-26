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
import type {MlsWelcomeEventProcessor} from '../../../src/core/event/MlsWelcomeEventProcessor.js'
import type {MlsMessageEventProcessor} from '../../../src/core/event/MlsMessageEventProcessor.js'
import type {NewConversationEventProcessor} from '../../../src/core/event/NewConversationEventProcessor.js'
import type {DeleteConversationEventProcessor} from '../../../src/core/event/DeleteConversationEventProcessor.js'
import type {MemberJoinEventProcessor} from '../../../src/core/event/MemberJoinEventProcessor.js'
import type {MemberLeaveEventProcessor} from '../../../src/core/event/MemberLeaveEventProcessor.js'
import type {MemberUpdateEventProcessor} from '../../../src/core/event/MemberUpdateEventProcessor.js'

const makeEvent = (type: string) => ({type} as any)

const makeEventResponse = (payload?: EventContentDTO[]): EventResponse => ({
  id: 'notification-id',
  transient: false,
  ...(payload !== undefined && {payload}),
})

let mlsWelcomeEventProcessor: MlsWelcomeEventProcessor
let mlsMessageEventProcessor: MlsMessageEventProcessor
let newConversationEventProcessor: NewConversationEventProcessor
let deleteConversationEventProcessor: DeleteConversationEventProcessor
let memberJoinEventProcessor: MemberJoinEventProcessor
let memberLeaveEventProcessor: MemberLeaveEventProcessor
let memberUpdateEventProcessor: MemberUpdateEventProcessor
let router: EventRouter

beforeEach(() => {
  vi.clearAllMocks()

  mlsWelcomeEventProcessor = {process: vi.fn().mockResolvedValue(undefined)} as any
  mlsMessageEventProcessor = {process: vi.fn().mockResolvedValue(undefined)} as any
  newConversationEventProcessor = {process: vi.fn().mockResolvedValue(undefined)} as any
  deleteConversationEventProcessor = {process: vi.fn().mockResolvedValue(undefined)} as any
  memberJoinEventProcessor = {process: vi.fn().mockResolvedValue(undefined)} as any
  memberLeaveEventProcessor = {process: vi.fn().mockResolvedValue(undefined)} as any
  memberUpdateEventProcessor = {process: vi.fn().mockResolvedValue(undefined)} as any

  router = new EventRouter(
    mlsWelcomeEventProcessor,
    mlsMessageEventProcessor,
    newConversationEventProcessor,
    deleteConversationEventProcessor,
    memberJoinEventProcessor,
    memberLeaveEventProcessor,
    memberUpdateEventProcessor,
  )
})

describe('EventRouter', () => {
  describe('route', () => {
    it('should do nothing when payload is undefined', async () => {
      await router.route(makeEventResponse())

      expect(mlsWelcomeEventProcessor.process).not.toHaveBeenCalled()
      expect(mlsMessageEventProcessor.process).not.toHaveBeenCalled()
      expect(newConversationEventProcessor.process).not.toHaveBeenCalled()
      expect(deleteConversationEventProcessor.process).not.toHaveBeenCalled()
      expect(memberJoinEventProcessor.process).not.toHaveBeenCalled()
      expect(memberLeaveEventProcessor.process).not.toHaveBeenCalled()
      expect(memberUpdateEventProcessor.process).not.toHaveBeenCalled()
    })

    it('should do nothing when payload is empty', async () => {
      await router.route(makeEventResponse([]))

      expect(mlsWelcomeEventProcessor.process).not.toHaveBeenCalled()
    })

    it('should route conversation.mls-welcome to mlsWelcomeEventProcessor', async () => {
      const event = makeEvent('conversation.mls-welcome')
      await router.route(makeEventResponse([event]))

      expect(mlsWelcomeEventProcessor.process).toHaveBeenCalledTimes(1)
      expect(mlsWelcomeEventProcessor.process).toHaveBeenCalledWith(event)
    })

    it('should route conversation.mls-message-add to mlsMessageEventProcessor', async () => {
      const event = makeEvent('conversation.mls-message-add')
      await router.route(makeEventResponse([event]))

      expect(mlsMessageEventProcessor.process).toHaveBeenCalledTimes(1)
      expect(mlsMessageEventProcessor.process).toHaveBeenCalledWith(event)
    })

    it('should route conversation.create to newConversationEventProcessor', async () => {
      const event = makeEvent('conversation.create')
      await router.route(makeEventResponse([event]))

      expect(newConversationEventProcessor.process).toHaveBeenCalledTimes(1)
      expect(newConversationEventProcessor.process).toHaveBeenCalledWith(event)
    })

    it('should route conversation.delete to deleteConversationEventProcessor', async () => {
      const event = makeEvent('conversation.delete')
      await router.route(makeEventResponse([event]))

      expect(deleteConversationEventProcessor.process).toHaveBeenCalledTimes(1)
      expect(deleteConversationEventProcessor.process).toHaveBeenCalledWith(event)
    })

    it('should route conversation.member-join to memberJoinEventProcessor', async () => {
      const event = makeEvent('conversation.member-join')
      await router.route(makeEventResponse([event]))

      expect(memberJoinEventProcessor.process).toHaveBeenCalledTimes(1)
      expect(memberJoinEventProcessor.process).toHaveBeenCalledWith(event)
    })

    it('should route conversation.member-leave to memberLeaveEventProcessor', async () => {
      const event = makeEvent('conversation.member-leave')
      await router.route(makeEventResponse([event]))

      expect(memberLeaveEventProcessor.process).toHaveBeenCalledTimes(1)
      expect(memberLeaveEventProcessor.process).toHaveBeenCalledWith(event)
    })

    it('should route conversation.member-update to memberUpdateEventProcessor', async () => {
      const event = makeEvent('conversation.member-update')
      await router.route(makeEventResponse([event]))

      expect(memberUpdateEventProcessor.process).toHaveBeenCalledTimes(1)
      expect(memberUpdateEventProcessor.process).toHaveBeenCalledWith(event)
    })

    it('should silently ignore conversation.typing events', async () => {
      await router.route(makeEventResponse([makeEvent('conversation.typing')]))

      expect(mlsWelcomeEventProcessor.process).not.toHaveBeenCalled()
      expect(mlsMessageEventProcessor.process).not.toHaveBeenCalled()
      expect(newConversationEventProcessor.process).not.toHaveBeenCalled()
      expect(deleteConversationEventProcessor.process).not.toHaveBeenCalled()
      expect(memberJoinEventProcessor.process).not.toHaveBeenCalled()
      expect(memberLeaveEventProcessor.process).not.toHaveBeenCalled()
      expect(memberUpdateEventProcessor.process).not.toHaveBeenCalled()
    })

    it('should not route unknown event types to any processor', async () => {
      await router.route(makeEventResponse([makeEvent('conversation.unknown-event')]))

      expect(mlsWelcomeEventProcessor.process).not.toHaveBeenCalled()
      expect(mlsMessageEventProcessor.process).not.toHaveBeenCalled()
      expect(newConversationEventProcessor.process).not.toHaveBeenCalled()
      expect(deleteConversationEventProcessor.process).not.toHaveBeenCalled()
      expect(memberJoinEventProcessor.process).not.toHaveBeenCalled()
      expect(memberLeaveEventProcessor.process).not.toHaveBeenCalled()
      expect(memberUpdateEventProcessor.process).not.toHaveBeenCalled()
    })

    it('should route multiple events in a single payload to their respective processors', async () => {
      const welcome = makeEvent('conversation.mls-welcome')
      const memberJoin = makeEvent('conversation.member-join')
      const newConversation = makeEvent('conversation.create')

      await router.route(makeEventResponse([welcome, memberJoin, newConversation]))

      expect(mlsWelcomeEventProcessor.process).toHaveBeenCalledWith(welcome)
      expect(memberJoinEventProcessor.process).toHaveBeenCalledWith(memberJoin)
      expect(newConversationEventProcessor.process).toHaveBeenCalledWith(newConversation)
    })

    it('should process events sequentially and await each one', async () => {
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

    it('should resolve without a value on success', async () => {
      await expect(router.route(makeEventResponse([makeEvent('conversation.create')]))).resolves.toBeUndefined()
    })
  })
})
