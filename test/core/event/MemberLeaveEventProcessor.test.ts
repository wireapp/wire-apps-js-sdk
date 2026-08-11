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
import type {MemberLeaveDTO} from '../../../src/model/EventContentDTO.js'
import {ConversationService} from '../../../src/api/ConversationService.js'
import {MemberLeaveEventProcessor} from '../../../src/core/event/MemberLeaveEventProcessor.js'
import type {WireEventsHandler} from '../../../src/core/WireEventsHandler.js'

vi.mock('../../../src/api/ConversationService.js')

const qualifiedConversation = {id: 'conv-123', domain: 'example.com'}
const qualifiedFrom = {id: 'user-from', domain: 'example.com'}

const makeUser = (id: string) => ({id, domain: 'example.com'})

const makeEvent = (qualifiedUserIds = [makeUser('user-1')]): MemberLeaveDTO => ({
  type: 'conversation.member-leave',
  time: new Date(),
  qualified_conversation: qualifiedConversation,
  qualified_from: qualifiedFrom,
  data: {
    qualified_user_ids: qualifiedUserIds,
    reason: 'left'
  }
})

let conversationService: ConversationService
let wireEventsHandler: WireEventsHandler
let processor: MemberLeaveEventProcessor

beforeEach(() => {
  vi.clearAllMocks()

  conversationService = {
    syncMembersRemoved: vi.fn().mockResolvedValue(undefined)
  } as any

  wireEventsHandler = {
    onUserLeftConversation: vi.fn().mockResolvedValue(undefined)
  } as any

  processor = new MemberLeaveEventProcessor(conversationService, wireEventsHandler)
})

describe('MemberLeaveEventProcessor', () => {
  describe('process', () => {
    it('should call removeMembers with the qualified user ids and qualified conversation', async () => {
      const userIds = [makeUser('user-1')]
      await processor.process(makeEvent(userIds))

      expect(conversationService.syncMembersRemoved).toHaveBeenCalledTimes(1)
      expect(conversationService.syncMembersRemoved).toHaveBeenCalledWith(userIds, qualifiedConversation)
    })

    it('should call onUserLeftConversation with the qualified conversation and qualified user ids', async () => {
      const userIds = [makeUser('user-1')]
      await processor.process(makeEvent(userIds))

      expect(wireEventsHandler.onUserLeftConversation).toHaveBeenCalledTimes(1)
      expect(wireEventsHandler.onUserLeftConversation).toHaveBeenCalledWith(qualifiedConversation, userIds)
    })

    it('should handle multiple users leaving at once', async () => {
      const userIds = [makeUser('user-1'), makeUser('user-2'), makeUser('user-3')]
      await processor.process(makeEvent(userIds))

      expect(conversationService.syncMembersRemoved).toHaveBeenCalledWith(userIds, qualifiedConversation)
      expect(wireEventsHandler.onUserLeftConversation).toHaveBeenCalledWith(qualifiedConversation, userIds)
    })

    it('should handle an empty qualified_user_ids array', async () => {
      await processor.process(makeEvent([]))

      expect(conversationService.syncMembersRemoved).toHaveBeenCalledWith([], qualifiedConversation)
      expect(wireEventsHandler.onUserLeftConversation).toHaveBeenCalledWith(qualifiedConversation, [])
    })

    it('should call removeMembers before onUserLeftConversation', async () => {
      const callOrder: string[] = []

      vi.mocked(conversationService.syncMembersRemoved).mockImplementation(async () => {
        callOrder.push('removeMembers')
      })
      vi.mocked(wireEventsHandler.onUserLeftConversation).mockImplementation(async () => {
        callOrder.push('onUserLeftConversation')
      })

      await processor.process(makeEvent())

      expect(callOrder).toEqual(['removeMembers', 'onUserLeftConversation'])
    })

    it('should propagate errors from removeMembers and not call onUserLeftConversation', async () => {
      vi.mocked(conversationService.syncMembersRemoved).mockRejectedValue(new Error('removeMembers failed'))

      await expect(processor.process(makeEvent())).rejects.toThrow('removeMembers failed')
      expect(wireEventsHandler.onUserLeftConversation).not.toHaveBeenCalled()
    })

    it('should propagate errors from onUserLeftConversation', async () => {
      vi.mocked(wireEventsHandler.onUserLeftConversation).mockRejectedValue(new Error('onUserLeftConversation failed'))

      await expect(processor.process(makeEvent())).rejects.toThrow('onUserLeftConversation failed')
    })

    it('should resolve without a value on success', async () => {
      await expect(processor.process(makeEvent())).resolves.toBeUndefined()
    })
  })
})
