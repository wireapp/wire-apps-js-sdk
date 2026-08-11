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
import type {MlsResetDTO} from '../../../src/model/EventContentDTO.js'
import {ConversationService} from '../../../src/api/ConversationService.js'
import {MlsResetEventProcessor} from '../../../src/core/event/MlsResetEventProcessor.js'
import {QualifiedId} from '../../../src/model/QualifiedId.js'

vi.mock('../../../src/api/ConversationService.js')

const qualifiedConversation = {id: 'conv-123', domain: 'example.com'}
const qualifiedFrom = {id: 'user-456', domain: 'example.com'}
const OLD_GROUP_ID = 'oldGroupIdBase64=='
const NEW_GROUP_ID = 'newGroupIdBase64=='

const makeEvent = (): MlsResetDTO => ({
  type: 'conversation.mls-reset',
  time: new Date(),
  qualified_conversation: qualifiedConversation,
  qualified_from: qualifiedFrom,
  data: {
    group_id: OLD_GROUP_ID,
    new_group_id: NEW_GROUP_ID
  }
})

let conversationService: ConversationService
let processor: MlsResetEventProcessor

beforeEach(() => {
  vi.clearAllMocks()

  conversationService = {
    resetMlsConversation: vi.fn().mockResolvedValue(undefined)
  } as any

  processor = new MlsResetEventProcessor(conversationService)
})

describe('MlsResetEventProcessor', () => {
  describe('process', () => {
    it('should have the correct eventType', () => {
      expect(processor.eventType).toBe('conversation.mls-reset')
    })

    it('should delegate to ConversationService.resetMlsConversation with the new groupId', async () => {
      await processor.process(makeEvent())

      expect(conversationService.resetMlsConversation).toHaveBeenCalledTimes(1)
      expect(conversationService.resetMlsConversation).toHaveBeenCalledWith(
        new QualifiedId(qualifiedConversation.id, qualifiedConversation.domain),
        NEW_GROUP_ID
      )
    })

    it('should propagate errors from resetMlsConversation', async () => {
      vi.mocked(conversationService.resetMlsConversation).mockRejectedValue(new Error('reset failed'))

      await expect(processor.process(makeEvent())).rejects.toThrow('reset failed')
    })

    it('should resolve without a value on success', async () => {
      await expect(processor.process(makeEvent())).resolves.toBeUndefined()
    })
  })
})
