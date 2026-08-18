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
import type {MessageTimerUpdateDTO} from '../../../src/model/EventContentDTO.js'
import {ConversationService} from '../../../src/api/ConversationService.js'
import {MessageTimerUpdateEventProcessor} from '../../../src/core/event/MessageTimerUpdateEventProcessor.js'
import {QualifiedId} from '../../../src/model/QualifiedId.js'

vi.mock('../../../src/api/ConversationService.js')

const qualifiedConversation = {id: 'conv-123', domain: 'example.com'}
const messageTimer = 604800000

const makeEvent = (): MessageTimerUpdateDTO =>
  ({
    type: 'conversation.message-timer-update',
    qualified_conversation: qualifiedConversation,
    data: {message_timer: messageTimer}
  }) as any

let conversationService: ConversationService
let processor: MessageTimerUpdateEventProcessor

beforeEach(() => {
  vi.clearAllMocks()

  conversationService = {
    updateMessageTimer: vi.fn().mockResolvedValue(undefined)
  } as any

  processor = new MessageTimerUpdateEventProcessor(conversationService)
})

describe('MessageTimerUpdateEventProcessor', () => {
  describe('process', () => {
    it('should update the message timer using the qualified conversation id and timer value', async () => {
      await processor.process(makeEvent())

      expect(conversationService.updateMessageTimer).toHaveBeenCalledTimes(1)
      expect(conversationService.updateMessageTimer).toHaveBeenCalledWith(
        new QualifiedId(qualifiedConversation.id, qualifiedConversation.domain),
        messageTimer
      )
    })

    it('should build the QualifiedId from the event id and domain', async () => {
      const event = makeEvent()

      await processor.process(event)

      expect(conversationService.updateMessageTimer).toHaveBeenCalledWith(
        expect.objectContaining({id: qualifiedConversation.id, domain: qualifiedConversation.domain}),
        messageTimer
      )
    })

    it('should propagate errors from updateMessageTimer', async () => {
      const error = new Error('update failed')
      vi.mocked(conversationService.updateMessageTimer).mockRejectedValue(error)

      await expect(processor.process(makeEvent())).rejects.toThrow('update failed')
    })

    it('should resolve without a value on success', async () => {
      await expect(processor.process(makeEvent())).resolves.toBeUndefined()
    })
  })
})
