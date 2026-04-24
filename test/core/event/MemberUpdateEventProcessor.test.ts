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
import type {MemberUpdateDTO} from '../../../src/model/EventContentDTO.js'
import {ConversationService} from '../../../src/api/ConversationService.js'
import {MemberUpdateEventProcessor} from '../../../src/core/event/MemberUpdateEventProcessor.js'
import {ConversationRole} from '../../../src/model/conversation/ConversationRole.js'

vi.mock('../../../src/api/ConversationService.js')

const qualifiedConversation = {id: 'conv-123', domain: 'example.com'}
const qualifiedTarget = {id: 'user-1', domain: 'example.com'}

const makeEvent = (role = ConversationRole.MEMBER): MemberUpdateDTO => ({
  type: 'conversation.member-update',
  time: new Date(),
  qualified_conversation: qualifiedConversation,
  qualified_from: {id: 'user-from', domain: 'example.com'},
  data: {
    qualified_target: qualifiedTarget,
    conversation_role: role,
  },
})

let conversationService: ConversationService
let processor: MemberUpdateEventProcessor

beforeEach(() => {
  vi.clearAllMocks()

  conversationService = {
    syncMemberUpdate: vi.fn().mockResolvedValue(undefined),
  } as any

  processor = new MemberUpdateEventProcessor(conversationService)
})

describe('MemberUpdateEventProcessor', () => {
  describe('process', () => {
    it('should call syncMemberUpdate with the qualified target, qualified conversation and role', async () => {
      await processor.process(makeEvent(ConversationRole.MEMBER))

      expect(conversationService.syncMemberUpdate).toHaveBeenCalledTimes(1)
      expect(conversationService.syncMemberUpdate).toHaveBeenCalledWith(
        qualifiedTarget,
        qualifiedConversation,
        ConversationRole.MEMBER
      )
    })

    it('should pass the correct role when promoting to admin', async () => {
      await processor.process(makeEvent(ConversationRole.ADMIN))

      expect(conversationService.syncMemberUpdate).toHaveBeenCalledWith(
        qualifiedTarget,
        qualifiedConversation,
        ConversationRole.ADMIN
      )
    })

    it('should propagate errors from syncMemberUpdate', async () => {
      vi.mocked(conversationService.syncMemberUpdate).mockRejectedValue(new Error('syncMemberUpdate failed'))

      await expect(processor.process(makeEvent())).rejects.toThrow('syncMemberUpdate failed')
    })

    it('should resolve without a value on success', async () => {
      await expect(processor.process(makeEvent())).resolves.toBeUndefined()
    })
  })
})
