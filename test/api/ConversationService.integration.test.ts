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

import 'reflect-metadata'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { ConversationService } from '../../src/api/ConversationService.js'
import { UsersApiClient } from '../../src/api/UsersApiClient.js'
import { ConversationsApiClient } from '../../src/api/ConversationsApiClient.js'
import { ConversationRepository } from '../../src/db/ConversationRepository.js'
import { ConversationMemberRepository } from '../../src/db/ConversationMemberRepository.js'
import { ConversationType } from '../../src/model/conversation/ConversationType.js'
import type { QualifiedId } from '../../src/model/QualifiedId.js'
import type { ConversationResponse } from '../../src/api/response/ConversationResponse.js'
import { TestDatabaseService } from '../helpers/TestDatabaseService.js'
import { ConversationEntity } from '../../src/db/model/ConversationEntity.js'
import { ConversationMemberEntity } from '../../src/db/model/ConversationMemberEntity.js'
import {AppProperties} from '../../src/service/AppProperties.js'
import {CoreCryptoService} from '../../src/core/CoreCryptoService.js'

describe('ConversationService Integration', () => {
  let testDbService: TestDatabaseService
  let conversationService: ConversationService
  let conversationRepository: ConversationRepository
  let conversationMemberRepository: ConversationMemberRepository
  let mockUsersApiClient: UsersApiClient
  let mockConversationsApiClient: ConversationsApiClient
  let mockAppProperties: AppProperties
  let mockCoreCryptoService: CoreCryptoService

  beforeAll(() => {
    testDbService = new TestDatabaseService()
  })

  afterAll(() => {
    try {
      testDbService.close()
    } catch (exception) {
      console.error('Failed to close test database:', exception)
    }
  })

  beforeEach(() => {
    testDbService.clearData()

    conversationRepository = new ConversationRepository(testDbService)
    conversationMemberRepository = new ConversationMemberRepository(testDbService)

    mockUsersApiClient = {
      getUserName: vi.fn()
    } as any

    mockConversationsApiClient = {
      getConversation: vi.fn()
    } as any

    mockAppProperties = {
      getShouldRejoinConversations: vi.fn(),
      setShouldRejoinConversations: vi.fn()
    } as any

    mockCoreCryptoService = {
      conversationExists: vi.fn(),
      joinMlsConversation: vi.fn(),
      establishMlsConversation: vi.fn(),
      wipeConversation: vi.fn()
    } as any

    conversationService = new ConversationService(
      SELF_USER_ID.id,
      SELF_USER_ID.domain,
      mockUsersApiClient,
      mockConversationsApiClient,
      conversationRepository,
      conversationMemberRepository,
      mockAppProperties,
      mockCoreCryptoService
    )

    // TODO: Can remove/replace this once we have implemented a proper logger lib
    // Suppress console.info for cleaner test output
    console.info = () => {}
  })

  describe('saveConversationWithMembers', () => {
    it('should save conversation and members to real database', async () => {
      const result = await conversationService.saveConversationWithMembers(
        CONVERSATION_ID,
        CONVERSATION_RESPONSE
      )

      expect(result.conversation.name).toBe(CONVERSATION_NAME)
      expect(result.members).toHaveLength(2)

      const savedConversation = await conversationService.getConversationById(CONVERSATION_ID)

      expect(savedConversation).toBeDefined()
      expect((savedConversation as ConversationEntity).name).toBe(CONVERSATION_NAME)
      expect((savedConversation as ConversationEntity).team_id).toBe(TEAM_ID)
      expect((savedConversation as ConversationEntity).mls_group_id).toBe(MLS_GROUP_ID)

      const savedMembers = conversationService.getMembersByConversationId(CONVERSATION_ID)

      expect(savedMembers).toHaveLength(2)
      expect(savedMembers.map((m: ConversationMemberEntity) => m.user_id)).toContain(USER_ID.id)
      expect(savedMembers.map((m: ConversationMemberEntity) => m.user_domain)).toContain(USER_ID.domain)
      expect(savedMembers.map((m: ConversationMemberEntity) => m.conversation_id)).toContain(CONVERSATION_ID.id)
      expect(savedMembers.map((m: ConversationMemberEntity) => m.conversation_domain)).toContain(CONVERSATION_ID.domain)
    })

    it('should fetch user name from API for ONE_TO_ONE conversations', async () => {
      let userNameRequested = false
      mockUsersApiClient.getUserName = async (userId: QualifiedId) => {
        userNameRequested = true
        expect(userId.id).toBe(USER_ID.id)
        expect(userId.domain).toBe(USER_ID.domain)
        return ONE_TO_ONE_CONVERSATION_NAME
      }

      const result = await conversationService.saveConversationWithMembers(
        CONVERSATION_ID,
        ONE_TO_ONE_CONVERSATION_RESPONSE
      )

      expect(userNameRequested).toBe(true)
      expect(result.conversation.name).toBe(ONE_TO_ONE_CONVERSATION_NAME)

      const savedConversation = await conversationService.getConversationById(CONVERSATION_ID)

      expect(savedConversation.name).toBe(ONE_TO_ONE_CONVERSATION_NAME)
    })
  })

  describe('Complex scenarios', () => {
    it('should handle multiple conversations and members', async () => {
      await conversationService.saveConversationWithMembers(CONVERSATION_ID, CONVERSATION_RESPONSE)
      await conversationService.saveConversationWithMembers(OTHER_CONVERSATION_ID, OTHER_CONVERSATION_RESPONSE)

      const firstConversation = await conversationService.getConversationById(CONVERSATION_ID)
      expect(firstConversation).toBeDefined()

      const secondConversation = await conversationService.getConversationById(CONVERSATION_ID)
      expect(secondConversation).toBeDefined()

      const firstConversationMembers = conversationService.getMembersByConversationId(CONVERSATION_ID)
      expect(firstConversationMembers).toHaveLength(2)

      const secondConversationMembers = conversationService.getMembersByConversationId(OTHER_CONVERSATION_ID)
      expect(secondConversationMembers).toHaveLength(2)
    })

    it('should throw error when conversation not found in API', async () => {
      vi.mocked(mockConversationsApiClient.getConversation).mockRejectedValue(new Error('Not found'))

      await expect(conversationService.getConversationById(CONVERSATION_ID)).rejects.toThrow()
    })
  })

  describe('removeMembers', () => {
    beforeEach(async () => {
      // ensure conversation exists before attempting to remove members
      await conversationService.saveConversationWithMembers(CONVERSATION_ID, CONVERSATION_RESPONSE)
    })

    it('calls deleteAllConversationDataFromLocalStorages when APP_CLIENT_ID is in userIds', async () => {
      process.env["APP_CLIENT_ID"] = SELF_USER_ID.id

      const wipeSpy = vi
        .spyOn(conversationService as any, 'deleteAllConversationDataFromLocalStorages')
        .mockResolvedValue(undefined)

      await conversationService.removeMembers([SELF_USER_ID, USER_3_ID], CONVERSATION_ID)

      expect(wipeSpy).toHaveBeenCalledWith(CONVERSATION_ID)

      wipeSpy.mockRestore()
      delete process.env["APP_CLIENT_ID"]
    })

    it('does not call deleteAllConversationDataFromLocalStorages when APP_CLIENT_ID is not in userIds', async () => {
      process.env["APP_CLIENT_ID"] = USER_ID.id

      const wipeSpy = vi
        .spyOn(conversationService as any, 'deleteAllConversationDataFromLocalStorages')
        .mockResolvedValue(undefined)

      await conversationService.removeMembers([USER_3_ID, USER_4_ID], CONVERSATION_ID)

      expect(wipeSpy).not.toHaveBeenCalled()

      wipeSpy.mockRestore()
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
  const USER_3_ID: QualifiedId = {
    id: "user-id-3",
    domain: "wire.com"
  }
  const USER_4_ID: QualifiedId = {
    id: "user-id-4",
    domain: "wire.com"
  }
  const CONVERSATION_ID: QualifiedId = {
    id: 'conversation-id',
    domain: 'wire.com'
  }

  const OTHER_CONVERSATION_ID: QualifiedId = {
    id: 'other-conversation-id',
    domain: 'wire.com'
  }

  const CONVERSATION_NAME: string = "Test Conversation"
  const OTHER_CONVERSATION_NAME: string = "Other Test Conversation"
  const ONE_TO_ONE_CONVERSATION_NAME: string = "Dummy One To One User"

  const MLS_GROUP_ID: string = 'mls-group-id-1234'
  const OTHER_MLS_GROUP_ID: string = 'mls-group-id-5678'

  const CONVERSATION_RESPONSE: ConversationResponse = {
    qualified_id: CONVERSATION_ID,
    type: ConversationType.GROUP,
    name: CONVERSATION_NAME,
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

  const OTHER_CONVERSATION_RESPONSE: ConversationResponse = {
    qualified_id: OTHER_CONVERSATION_ID,
    type: ConversationType.GROUP,
    name: OTHER_CONVERSATION_NAME,
    team: TEAM_ID,
    group_id: OTHER_MLS_GROUP_ID,
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

  const ONE_TO_ONE_CONVERSATION_RESPONSE: ConversationResponse = {
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

})
