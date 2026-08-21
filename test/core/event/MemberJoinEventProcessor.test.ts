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
import type {MemberJoinDTO} from '../../../src/model/EventContentDTO.js'
import {ConversationService} from '../../../src/api/ConversationService.js'
import {MemberJoinEventProcessor} from '../../../src/core/event/MemberJoinEventProcessor.js'
import type {WireEventsHandler} from '../../../src/core/WireEventsHandler.js'
import {ConversationRole} from '../../../src/model/conversation/ConversationRole.js'

vi.mock('../../../src/api/ConversationService.js')

const qualifiedConversation = {id: 'conv-123', domain: 'example.com'}
const qualifiedFrom = {id: 'user-from', domain: 'example.com'}

const makeUser = (id: string, role = ConversationRole.MEMBER) => ({
  qualified_id: {id, domain: 'example.com'},
  conversation_role: role
})

const makeEvent = (users = [makeUser('user-1')]): MemberJoinDTO => ({
  type: 'conversation.member-join',
  time: new Date(),
  qualified_conversation: qualifiedConversation,
  qualified_from: qualifiedFrom,
  data: {users}
})

let conversationService: ConversationService
let wireEventsHandler: WireEventsHandler
let processor: MemberJoinEventProcessor

beforeEach(() => {
  vi.clearAllMocks()

  conversationService = {
    syncMembersAdded: vi.fn().mockResolvedValue(true)
  } as any

  wireEventsHandler = {
    onUserJoinedConversation: vi.fn().mockResolvedValue(undefined)
  } as any

  processor = new MemberJoinEventProcessor(conversationService, wireEventsHandler)
})

describe('MemberJoinEventProcessor', () => {
  describe('process', () => {
    it('should call addMembers with mapped members and the qualified conversation', async () => {
      const event = makeEvent([makeUser('user-1', ConversationRole.MEMBER)])

      await processor.process(event)

      expect(conversationService.syncMembersAdded).toHaveBeenCalledTimes(1)
      expect(conversationService.syncMembersAdded).toHaveBeenCalledWith(
        [{userId: {id: 'user-1', domain: 'example.com'}, role: ConversationRole.MEMBER}],
        qualifiedConversation
      )
    })

    it('should call onUserJoinedConversation with the qualified conversation and mapped members', async () => {
      const event = makeEvent([makeUser('user-1', ConversationRole.ADMIN)])

      await processor.process(event)

      expect(wireEventsHandler.onUserJoinedConversation).toHaveBeenCalledTimes(1)
      expect(wireEventsHandler.onUserJoinedConversation).toHaveBeenCalledWith(qualifiedConversation, [
        {userId: {id: 'user-1', domain: 'example.com'}, role: ConversationRole.ADMIN}
      ])
    })

    it('should map multiple users correctly', async () => {
      const event = makeEvent([makeUser('user-1', ConversationRole.ADMIN), makeUser('user-2', ConversationRole.MEMBER)])

      await processor.process(event)

      const expectedMembers = [
        {userId: {id: 'user-1', domain: 'example.com'}, role: ConversationRole.ADMIN},
        {userId: {id: 'user-2', domain: 'example.com'}, role: ConversationRole.MEMBER}
      ]
      expect(conversationService.syncMembersAdded).toHaveBeenCalledWith(expectedMembers, qualifiedConversation)
      expect(wireEventsHandler.onUserJoinedConversation).toHaveBeenCalledWith(qualifiedConversation, expectedMembers)
    })

    it('should handle an empty users array', async () => {
      const event = makeEvent([])

      await processor.process(event)

      expect(conversationService.syncMembersAdded).toHaveBeenCalledWith([], qualifiedConversation)
      expect(wireEventsHandler.onUserJoinedConversation).toHaveBeenCalledWith(qualifiedConversation, [])
    })

    it('should call addMembers before onUserJoinedConversation', async () => {
      const callOrder: string[] = []

      vi.mocked(conversationService.syncMembersAdded).mockImplementation(async () => {
        callOrder.push('addMembers')
        return true
      })
      vi.mocked(wireEventsHandler.onUserJoinedConversation).mockImplementation(async () => {
        callOrder.push('onUserJoinedConversation')
      })

      await processor.process(makeEvent())

      expect(callOrder).toEqual(['addMembers', 'onUserJoinedConversation'])
    })

    it('should propagate errors from addMembers and not call onUserJoinedConversation', async () => {
      vi.mocked(conversationService.syncMembersAdded).mockRejectedValue(new Error('addMembers failed'))

      await expect(processor.process(makeEvent())).rejects.toThrow('addMembers failed')
      expect(wireEventsHandler.onUserJoinedConversation).not.toHaveBeenCalled()
    })

    it('should not call onUserJoinedConversation when the members were not applied (conversation unknown locally)', async () => {
      vi.mocked(conversationService.syncMembersAdded).mockResolvedValue(false)

      await processor.process(makeEvent())

      expect(wireEventsHandler.onUserJoinedConversation).not.toHaveBeenCalled()
    })

    it('should propagate errors from onUserJoinedConversation', async () => {
      vi.mocked(wireEventsHandler.onUserJoinedConversation).mockRejectedValue(
        new Error('onUserJoinedConversation failed')
      )

      await expect(processor.process(makeEvent())).rejects.toThrow('onUserJoinedConversation failed')
    })

    it('should resolve without a value on success', async () => {
      await expect(processor.process(makeEvent())).resolves.toBeUndefined()
    })
  })
})
