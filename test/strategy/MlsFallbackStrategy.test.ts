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

import {describe, it, expect, beforeEach, vi} from 'vitest'
import type {CoreCryptoService} from '../../src/core/CoreCryptoService.js'
import {MlsFallbackStrategy} from '../../src/strategy/MlsFallbackStrategy.js'
import type {ConversationService} from '../../src/api/ConversationService.js'
import type {QualifiedId} from '../../src/model/QualifiedId.js'
import type {ConversationResponse} from '../../src/api/response/ConversationResponse.js'
import {container} from 'tsyringe'

vi.mock('../../src/core/CoreCryptoService.js', () => ({
  CoreCryptoService: vi.fn()
}))

describe('MlsFallbackStrategy', () => {
  let mlsFallbackStrategy: MlsFallbackStrategy
  let mockCoreCryptoService: CoreCryptoService
  let mockConversationService: ConversationService

  beforeEach(() => {
    container.clearInstances()

    mockCoreCryptoService = {
      conversationExists: vi.fn(),
      conversationEpoch: vi.fn(),
      joinMlsConversationRequest: vi.fn()
    } as any

    mockConversationService = {
      fetchConversationById: vi.fn(),
      getConversationGroupInfo: vi.fn()
    } as any

    mlsFallbackStrategy = new MlsFallbackStrategy(
      mockCoreCryptoService,
      mockConversationService
    )

    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  describe('verifyConversationOutOfSync', () => {
    it('should join MLS conversation when conversation does not exist locally', async () => {
      const mockConversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        epoch: 10
      } as ConversationResponse

      const mockGroupInfoBytes = new Uint8Array([1, 2, 3, 4])

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)
      vi.mocked(mockConversationService.fetchConversationById).mockResolvedValue(mockConversationResponse)
      vi.mocked(mockCoreCryptoService.conversationEpoch).mockResolvedValue(5)
      vi.mocked(mockConversationService.getConversationGroupInfo).mockResolvedValue(mockGroupInfoBytes)

      await mlsFallbackStrategy.verifyConversationOutOfSync(MLS_GROUP_ID, CONVERSATION_ID)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.fetchConversationById).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockConversationService.getConversationGroupInfo).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockCoreCryptoService.joinMlsConversationRequest).toHaveBeenCalledWith(mockGroupInfoBytes)
    })

    it('should join MLS conversation when local epoch is behind remote epoch', async () => {
      const mockConversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        epoch: 10
      } as ConversationResponse

      const mockGroupInfoBytes = new Uint8Array([1, 2, 3, 4])

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)
      vi.mocked(mockConversationService.fetchConversationById).mockResolvedValue(mockConversationResponse)
      vi.mocked(mockCoreCryptoService.conversationEpoch).mockResolvedValue(5)
      vi.mocked(mockConversationService.getConversationGroupInfo).mockResolvedValue(mockGroupInfoBytes)

      await mlsFallbackStrategy.verifyConversationOutOfSync(MLS_GROUP_ID, CONVERSATION_ID)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.fetchConversationById).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockCoreCryptoService.conversationEpoch).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.getConversationGroupInfo).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockCoreCryptoService.joinMlsConversationRequest).toHaveBeenCalledWith(mockGroupInfoBytes)
    })

    it('should NOT join MLS conversation when conversation exists and epoch is in sync', async () => {
      const mockConversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        epoch: 5
      } as ConversationResponse

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)
      vi.mocked(mockConversationService.fetchConversationById).mockResolvedValue(mockConversationResponse)
      vi.mocked(mockCoreCryptoService.conversationEpoch).mockResolvedValue(5)

      await mlsFallbackStrategy.verifyConversationOutOfSync(MLS_GROUP_ID, CONVERSATION_ID)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.fetchConversationById).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockCoreCryptoService.conversationEpoch).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.getConversationGroupInfo).not.toHaveBeenCalled()
      expect(mockCoreCryptoService.joinMlsConversationRequest).not.toHaveBeenCalled()
    })

    it('should NOT join MLS conversation when conversation exists and local epoch is ahead of remote epoch', async () => {
      const mockConversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        epoch: 5
      } as ConversationResponse

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)
      vi.mocked(mockConversationService.fetchConversationById).mockResolvedValue(mockConversationResponse)
      vi.mocked(mockCoreCryptoService.conversationEpoch).mockResolvedValue(10)

      await mlsFallbackStrategy.verifyConversationOutOfSync(MLS_GROUP_ID, CONVERSATION_ID)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.fetchConversationById).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockCoreCryptoService.conversationEpoch).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.getConversationGroupInfo).not.toHaveBeenCalled()
      expect(mockCoreCryptoService.joinMlsConversationRequest).not.toHaveBeenCalled()
    })

    it('should NOT join MLS conversation when remote epoch is null', async () => {
      const mockConversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        epoch: null
      } as ConversationResponse

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)
      vi.mocked(mockConversationService.fetchConversationById).mockResolvedValue(mockConversationResponse)
      vi.mocked(mockCoreCryptoService.conversationEpoch).mockResolvedValue(5)

      await mlsFallbackStrategy.verifyConversationOutOfSync(MLS_GROUP_ID, CONVERSATION_ID)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.fetchConversationById).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockConversationService.getConversationGroupInfo).not.toHaveBeenCalled()
      expect(mockCoreCryptoService.joinMlsConversationRequest).not.toHaveBeenCalled()
    })

    it('should join MLS conversation when conversation does not exist even if epoch would be in sync', async () => {
      const mockConversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        epoch: 5
      } as ConversationResponse

      const mockGroupInfoBytes = new Uint8Array([5, 6, 7, 8])

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)
      vi.mocked(mockConversationService.fetchConversationById).mockResolvedValue(mockConversationResponse)
      vi.mocked(mockCoreCryptoService.conversationEpoch).mockResolvedValue(5)
      vi.mocked(mockConversationService.getConversationGroupInfo).mockResolvedValue(mockGroupInfoBytes)

      await mlsFallbackStrategy.verifyConversationOutOfSync(MLS_GROUP_ID, CONVERSATION_ID)

      expect(mockConversationService.getConversationGroupInfo).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockCoreCryptoService.joinMlsConversationRequest).toHaveBeenCalledWith(mockGroupInfoBytes)
    })

    it('should join MLS conversation when both conditions are true (does not exist AND epoch behind)', async () => {
      const mockConversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        epoch: 10
      } as ConversationResponse

      const mockGroupInfoBytes = new Uint8Array([9, 10, 11, 12])

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)
      vi.mocked(mockConversationService.fetchConversationById).mockResolvedValue(mockConversationResponse)
      vi.mocked(mockCoreCryptoService.conversationEpoch).mockResolvedValue(5)
      vi.mocked(mockConversationService.getConversationGroupInfo).mockResolvedValue(mockGroupInfoBytes)

      await mlsFallbackStrategy.verifyConversationOutOfSync(MLS_GROUP_ID, CONVERSATION_ID)

      expect(mockConversationService.getConversationGroupInfo).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockCoreCryptoService.joinMlsConversationRequest).toHaveBeenCalledWith(mockGroupInfoBytes)
    })
  })

  const CONVERSATION_ID: QualifiedId = {
    id: 'conversation-id',
    domain: 'wire.com'
  }
  const MLS_GROUP_ID: string = 'mls-group-id-1234'
})
