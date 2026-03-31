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
import type {NewConversationDTO} from '../../../src/model/EventContentDTO.js'
import {ConversationService} from '../../../src/api/ConversationService.js'
import {NewConversationEventProcessor} from '../../../src/core/event/NewConversationEventProcessor.js'

vi.mock('../../../src/api/ConversationService.js')

const qualifiedConversation = {id: 'conv-123', domain: 'example.com'}

const makeConversationResponse = () => ({
  qualified_id: qualifiedConversation,
  name: 'Test Conversation',
  type: 0,
  group_id: 'mls-group-id',
  epoch: 1,
  protocol: 'mls',
  team: 'team-1',
  members: {self: {}, others: []},
} as any)

const makeEvent = (): NewConversationDTO => ({
  type: 'conversation.create',
  time: new Date(),
  qualified_conversation: qualifiedConversation,
  qualified_from: {id: 'user-from', domain: 'example.com'},
  data: makeConversationResponse(),
})

let conversationService: ConversationService
let processor: NewConversationEventProcessor

beforeEach(() => {
  vi.clearAllMocks()

  conversationService = {
    saveConversationWithMembers: vi.fn().mockResolvedValue(undefined),
  } as any

  processor = new NewConversationEventProcessor(conversationService)
})

describe('NewConversationEventProcessor', () => {
  describe('process', () => {
    it('should call saveConversationWithMembers with the qualified conversation and conversation data', async () => {
      const event = makeEvent()

      await processor.process(event)

      expect(conversationService.saveConversationWithMembers).toHaveBeenCalledTimes(1)
      expect(conversationService.saveConversationWithMembers).toHaveBeenCalledWith(qualifiedConversation, event.data)
    })

    it('should propagate errors from saveConversationWithMembers', async () => {
      vi.mocked(conversationService.saveConversationWithMembers).mockRejectedValue(new Error('save failed'))

      await expect(processor.process(makeEvent())).rejects.toThrow('save failed')
    })

    it('should resolve without a value on success', async () => {
      await expect(processor.process(makeEvent())).resolves.toBeUndefined()
    })
  })
})
