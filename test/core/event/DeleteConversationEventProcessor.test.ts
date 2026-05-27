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
import type {DeleteConversationDTO} from "../../../src/model/EventContentDTO.js";
import {ConversationService} from "../../../src/api/ConversationService.js";
import {DeleteConversationEventProcessor} from "../../../src/core/event/DeleteConversationEventProcessor.js";
import type { WireEventsHandler } from "../../../src/core/WireEventsHandler.js";

vi.mock('../../../src/api/ConversationService.js')
vi.mock('../../../src/core/WireEventsHandler.js')

const qualifiedConversation = {id: 'conv-123', domain: 'example.com'}
const qualifiedFrom = {id: 'user-456', domain: 'example.com'}

const makeEvent = (): DeleteConversationDTO => ({
  type: 'conversation.delete',
  time: new Date(),
  qualified_conversation: qualifiedConversation,
  qualified_from: qualifiedFrom,
})

let conversationService: ConversationService
let wireEventsHandler: WireEventsHandler
let processor: DeleteConversationEventProcessor

beforeEach(() => {
  vi.clearAllMocks()

  conversationService = {
    deleteAllConversationDataFromLocalStorages: vi.fn().mockResolvedValue(undefined),
  } as any

  wireEventsHandler = {
    onConversationDeleted: vi.fn().mockResolvedValue(undefined),
  } as any

  processor = new DeleteConversationEventProcessor(conversationService, wireEventsHandler)
})

describe('DeleteConversationEventProcessor', () => {
  describe('process', () => {
    it('should call deleteAllConversationDataFromLocalStorages with the qualified conversation', async () => {
      await processor.process(makeEvent())

      expect(conversationService.deleteAllConversationDataFromLocalStorages).toHaveBeenCalledTimes(1)
      expect(conversationService.deleteAllConversationDataFromLocalStorages).toHaveBeenCalledWith(qualifiedConversation)
    })

    it('should call onConversationDeleted with the qualified conversation', async () => {
      await processor.process(makeEvent())

      expect(wireEventsHandler.onConversationDeleted).toHaveBeenCalledTimes(1)
      expect(wireEventsHandler.onConversationDeleted).toHaveBeenCalledWith(qualifiedConversation)
    })

    it('should call deleteAllConversationDataFromLocalStorages before onConversationDeleted', async () => {
      const callOrder: string[] = []

      vi.mocked(conversationService.deleteAllConversationDataFromLocalStorages).mockImplementation(async () => {
        callOrder.push('deleteAllConversationDataFromLocalStorages')
      })
      vi.mocked(wireEventsHandler.onConversationDeleted).mockImplementation(async () => {
        callOrder.push('onConversationDeleted')
      })

      await processor.process(makeEvent())

      expect(callOrder).toEqual(['deleteAllConversationDataFromLocalStorages', 'onConversationDeleted'])
    })

    it('should propagate errors from deleteAllConversationDataFromLocalStorages and not call onConversationDeleted', async () => {
      vi.mocked(conversationService.deleteAllConversationDataFromLocalStorages).mockRejectedValue(new Error('Storage deletion failed'))

      await expect(processor.process(makeEvent())).rejects.toThrow('Storage deletion failed')
      expect(wireEventsHandler.onConversationDeleted).not.toHaveBeenCalled()
    })

    it('should propagate errors from onConversationDeleted', async () => {
      vi.mocked(wireEventsHandler.onConversationDeleted).mockRejectedValue(new Error('Wire event handler failed'))

      await expect(processor.process(makeEvent())).rejects.toThrow('Wire event handler failed')
    })

    it('should resolve without a value on success', async () => {
      await expect(processor.process(makeEvent())).resolves.toBeUndefined()
    })
  })
})
