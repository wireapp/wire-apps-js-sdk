/*
* Wire
* Copyright (C) 2025 Wire Swiss GmbH
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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConversationService } from '../../src/api/ConversationService.js'
import { UsersApiClient } from '../../src/api/UsersApiClient.js'
import { ConversationsApiClient } from '../../src/api/ConversationsApiClient.js'
import { ConversationRepository } from '../../src/db/ConversationRepository.js'
import { ConversationMemberRepository } from '../../src/db/ConversationMemberRepository.js'
import { ConversationType } from '../../src/model/conversation/ConversationType.js'
import type { QualifiedId } from '../../src/model/QualifiedId.js'
import type { ConversationResponse } from '../../src/api/response/ConversationResponse.js'
import type { ConversationEntity } from '../../src/db/model/ConversationEntity.js'
import { container } from 'tsyringe'
import {AppService} from '../../src/api/AppService.js'
import {CoreCryptoService} from '../../src/core/CoreCryptoService.js'

describe('ConversationService', () => {
  let conversationService: ConversationService
  let mockUsersApiClient: UsersApiClient
  let mockConversationsApiClient: ConversationsApiClient
  let mockConversationRepository: ConversationRepository
  let mockConversationMemberRepository: ConversationMemberRepository
  let mockAppService: AppService
  let mockCoreCryptoService: CoreCryptoService

  beforeEach(() => {
    container.clearInstances()

    mockUsersApiClient = {
      getUserName: vi.fn()
    } as any

    mockConversationsApiClient = {
      getConversation: vi.fn()
    } as any

    mockConversationRepository = {
      save: vi.fn(),
      findByIdAndDomain: vi.fn()
    } as any

    mockConversationMemberRepository = {
      saveMany: vi.fn()
    } as any

    mockAppService = {
      getShouldRejoinConversations: vi.fn(),
      setShouldRejoinConversations: vi.fn()
    } as any

    mockCoreCryptoService = {
      conversationExists: vi.fn(),
      joinMlsConversationRequest: vi.fn(),
      establishMlsConversation: vi.fn()
    } as any

    conversationService = new ConversationService(
      mockUsersApiClient,
      mockConversationsApiClient,
      mockConversationRepository,
      mockConversationMemberRepository,
      mockAppService,
      mockCoreCryptoService
    )

    // TODO: Can remove/replace this once we have implemented a proper logger lib
    // Suppress console.info for cleaner test output
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  describe('saveConversationWithMembers', () => {
    it('should save ONE_TO_ONE conversation with user name from API', async () => {
      const conversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.ONE_TO_ONE,
        name: null,
        team: TEAM_ID,
        group_id: MLS_GROUP_ID,
        members: {
          others: [
            {
              qualified_id: USER_ID,
              conversation_role: 'wire_member'
            }
          ],
          self: {
            qualified_id: SELF_USER_ID,
            conversation_role: 'wire_admin'
          }
        }
      } as ConversationResponse

      vi.mocked(mockUsersApiClient.getUserName).mockResolvedValue('Dummy User')

      const result = await conversationService.saveConversationWithMembers(
        CONVERSATION_ID,
        conversationResponse
      )

      expect(mockUsersApiClient.getUserName).toHaveBeenCalledWith(USER_ID)

      expect(mockConversationRepository.save).toHaveBeenCalledWith({
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Dummy User',
        team_id: TEAM_ID,
        mls_group_id: MLS_GROUP_ID,
        creation_date: null,
        type: ConversationType.ONE_TO_ONE
      })

      expect(mockConversationMemberRepository.saveMany).toHaveBeenCalledWith([
        {
          user_id: SELF_USER_ID.id,
          user_domain: SELF_USER_ID.domain,
          conversation_id: CONVERSATION_ID.id,
          conversation_domain: CONVERSATION_ID.domain,
          role: 'wire_admin',
          creation_date: null
        },
        {
          user_id: USER_ID.id,
          user_domain: USER_ID.domain,
          conversation_id: CONVERSATION_ID.id,
          conversation_domain: CONVERSATION_ID.domain,
          role: 'wire_member',
          creation_date: null
        }
      ])

      expect(result.conversation.name).toBe('Dummy User')
      expect(result.members).toHaveLength(2)
    })

    it('should save GROUP conversation with conversation name', async () => {
      const conversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.GROUP,
        name: 'Test Conversation',
        team: TEAM_ID,
        group_id: MLS_GROUP_ID,
        members: {
          others: [
            {
              qualified_id: USER_ID,
              conversation_role: 'wire_member'
            }
          ],
          self: {
            qualified_id: SELF_USER_ID,
            conversation_role: 'wire_admin'
          }
        }
      } as ConversationResponse

      const result = await conversationService.saveConversationWithMembers(
        CONVERSATION_ID,
        conversationResponse
      )

      expect(mockUsersApiClient.getUserName).not.toHaveBeenCalled()
      expect(result.conversation.name).toBe('Test Conversation')
      expect(result.members).toHaveLength(2)
    })

    it('should use empty string when group conversation has no name', async () => {
      const conversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.GROUP,
        name: null,
        team: TEAM_ID,
        group_id: MLS_GROUP_ID,
        members: {
          others: [],
          self: {
            qualified_id: SELF_USER_ID,
            conversation_role: 'wire_admin'
          }
        }
      } as ConversationResponse

      const result = await conversationService.saveConversationWithMembers(
        CONVERSATION_ID,
        conversationResponse
      )

      expect(result.conversation.name).toBe('')
    })
  })

  describe('getConversationById', () => {
    it('should return conversation from database when it exists', async () => {
      const mockConversationEntity: ConversationEntity = {
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Existing Conversation',
        team_id: TEAM_ID,
        mls_group_id: MLS_GROUP_ID,
        creation_date: null,
        type: ConversationType.GROUP
      }

      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(mockConversationEntity)

      const result = await conversationService.getConversationById(CONVERSATION_ID)

      expect(mockConversationRepository.findByIdAndDomain).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockConversationsApiClient.getConversation).not.toHaveBeenCalled()
      expect(result).toEqual(mockConversationEntity)
    })

    it('should fetch and save conversation when not in database', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(null)

      const conversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.GROUP,
        name: 'New Conversation',
        team: TEAM_ID,
        group_id: MLS_GROUP_ID,
        members: {
          others: [
            {
              qualified_id: USER_ID,
              conversation_role: 'wire_member'
            }
          ],
          self: {
            qualified_id: SELF_USER_ID,
            conversation_role: 'wire_admin'
          }
        }
      } as ConversationResponse

      vi.mocked(mockConversationsApiClient.getConversation).mockResolvedValue(conversationResponse)

      const result = await conversationService.getConversationById(CONVERSATION_ID)

      expect(mockConversationRepository.findByIdAndDomain).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockConversationsApiClient.getConversation).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockConversationRepository.save).toHaveBeenCalled()
      expect(mockConversationMemberRepository.saveMany).toHaveBeenCalled()
      expect(result.name).toBe('New Conversation')
    })
  })

  describe('fetchConversationById', () => {
    it('should call conversationsApiClient and return response', async () => {
      const mockResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.GROUP,
        name: 'API Conversation',
        team: TEAM_ID,
        group_id: MLS_GROUP_ID,
        members: {
          others: [],
          self: {
            qualified_id: SELF_USER_ID,
            conversation_role: 'wire_admin'
          }
        }
      } as ConversationResponse

      vi.mocked(mockConversationsApiClient.getConversation).mockResolvedValue(mockResponse)

      const result = await conversationService.fetchConversationById(CONVERSATION_ID)

      expect(mockConversationsApiClient.getConversation).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getConversationMLSGroupId', () => {
    it('should return mls_group_id from conversation', async () => {
      const mockConversationEntity: ConversationEntity = {
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Test Conversation',
        team_id: TEAM_ID,
        mls_group_id: MLS_GROUP_ID,
        creation_date: null,
        type: ConversationType.GROUP
      }

      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(mockConversationEntity)

      const result = await conversationService.getConversationMLSGroupId(CONVERSATION_ID)

      expect(result).toBe(MLS_GROUP_ID)
    })
  })

  const TEAM_ID: string = "team-id"
  const SELF_USER_ID: QualifiedId = {
    id: "self-user-id",
    domain: "wire.com"
  }
  const USER_ID: QualifiedId = {
    id: "user-id",
    domain: "wire.com"
  }
  const CONVERSATION_ID: QualifiedId = {
    id: 'conversation-id',
    domain: 'wire.com'
  }
  const MLS_GROUP_ID: string = 'mls-group-id-1234'
})
