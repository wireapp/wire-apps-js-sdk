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
import {CoreCryptoService} from '../../src/core/CoreCryptoService.js'
import {MlsFallbackStrategy} from '../../src/service/MlsFallbackStrategy.js'
import {ConversationService} from '../../src/api/ConversationService.js'
import type {QualifiedId} from '../../src/model/QualifiedId.js'
import {container} from 'tsyringe'

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
      fetchEpoch: vi.fn(),
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
      const remoteEpoch = 10
      const mockGroupInfoBytes = new Uint8Array([1, 2, 3, 4])

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)
      vi.mocked(mockConversationService.fetchEpoch).mockResolvedValue(remoteEpoch)
      vi.mocked(mockCoreCryptoService.conversationEpoch).mockResolvedValue(5)
      vi.mocked(mockConversationService.getConversationGroupInfo).mockResolvedValue(mockGroupInfoBytes)

      await mlsFallbackStrategy.verifyConversationOutOfSync(MLS_GROUP_ID, CONVERSATION_ID)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.fetchEpoch).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockConversationService.getConversationGroupInfo).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockCoreCryptoService.joinMlsConversationRequest).toHaveBeenCalledWith(mockGroupInfoBytes)
    })

    it('should join MLS conversation when local epoch is behind remote epoch', async () => {
      const remoteEpoch = 10
      const mockGroupInfoBytes = new Uint8Array([1, 2, 3, 4])

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)
      vi.mocked(mockConversationService.fetchEpoch).mockResolvedValue(remoteEpoch)
      vi.mocked(mockCoreCryptoService.conversationEpoch).mockResolvedValue(5)
      vi.mocked(mockConversationService.getConversationGroupInfo).mockResolvedValue(mockGroupInfoBytes)

      await mlsFallbackStrategy.verifyConversationOutOfSync(MLS_GROUP_ID, CONVERSATION_ID)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.fetchEpoch).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockCoreCryptoService.conversationEpoch).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.getConversationGroupInfo).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockCoreCryptoService.joinMlsConversationRequest).toHaveBeenCalledWith(mockGroupInfoBytes)
    })

    it('should NOT join MLS conversation when conversation exists and epoch is in sync', async () => {
      const remoteEpoch = 5

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)
      vi.mocked(mockConversationService.fetchEpoch).mockResolvedValue(remoteEpoch)
      vi.mocked(mockCoreCryptoService.conversationEpoch).mockResolvedValue(5)

      await mlsFallbackStrategy.verifyConversationOutOfSync(MLS_GROUP_ID, CONVERSATION_ID)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.fetchEpoch).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockCoreCryptoService.conversationEpoch).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.getConversationGroupInfo).not.toHaveBeenCalled()
      expect(mockCoreCryptoService.joinMlsConversationRequest).not.toHaveBeenCalled()
    })

    it('should NOT join MLS conversation when conversation exists and local epoch is ahead of remote epoch', async () => {
      const remoteEpoch = 5

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)
      vi.mocked(mockConversationService.fetchEpoch).mockResolvedValue(remoteEpoch)
      vi.mocked(mockCoreCryptoService.conversationEpoch).mockResolvedValue(10)

      await mlsFallbackStrategy.verifyConversationOutOfSync(MLS_GROUP_ID, CONVERSATION_ID)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.fetchEpoch).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockCoreCryptoService.conversationEpoch).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.getConversationGroupInfo).not.toHaveBeenCalled()
      expect(mockCoreCryptoService.joinMlsConversationRequest).not.toHaveBeenCalled()
    })

    it('should NOT join MLS conversation when remote epoch is null', async () => {
      const remoteEpoch = null

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)
      vi.mocked(mockConversationService.fetchEpoch).mockResolvedValue(remoteEpoch)
      vi.mocked(mockCoreCryptoService.conversationEpoch).mockResolvedValue(5)

      await mlsFallbackStrategy.verifyConversationOutOfSync(MLS_GROUP_ID, CONVERSATION_ID)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationService.fetchEpoch).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockConversationService.getConversationGroupInfo).not.toHaveBeenCalled()
      expect(mockCoreCryptoService.joinMlsConversationRequest).not.toHaveBeenCalled()
    })

    it('should join MLS conversation when conversation does not exist even if epoch would be in sync', async () => {
      const remoteEpoch = 5
      const mockGroupInfoBytes = new Uint8Array([5, 6, 7, 8])

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)
      vi.mocked(mockConversationService.fetchEpoch).mockResolvedValue(remoteEpoch)
      vi.mocked(mockCoreCryptoService.conversationEpoch).mockResolvedValue(5)
      vi.mocked(mockConversationService.getConversationGroupInfo).mockResolvedValue(mockGroupInfoBytes)

      await mlsFallbackStrategy.verifyConversationOutOfSync(MLS_GROUP_ID, CONVERSATION_ID)

      expect(mockConversationService.getConversationGroupInfo).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockCoreCryptoService.joinMlsConversationRequest).toHaveBeenCalledWith(mockGroupInfoBytes)
    })

    it('should join MLS conversation when both conditions are true (does not exist AND epoch behind)', async () => {
      const remoteEpoch = 10
      const mockGroupInfoBytes = new Uint8Array([9, 10, 11, 12])

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)
      vi.mocked(mockConversationService.fetchEpoch).mockResolvedValue(remoteEpoch)
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
