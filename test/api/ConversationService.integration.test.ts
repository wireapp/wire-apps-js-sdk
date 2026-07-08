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
import { ConversationsApiClient } from '../../src/api/ConversationsApiClient.js'
import { ConversationRepository } from '../../src/db/ConversationRepository.js'
import { ConversationMemberRepository } from '../../src/db/ConversationMemberRepository.js'
import { ConversationType } from '../../src/model/conversation/ConversationType.js'
import type { QualifiedId } from '../../src/model/QualifiedId.js'
import type { ConversationResponse } from '../../src/api/response/ConversationResponse.js'
import { TestDatabaseService } from '../helpers/TestDatabaseService.js'
import type {ConversationEntity} from '../../src/db/model/ConversationEntity.js'
import {AppProperties} from '../../src/service/AppProperties.js'
import {CoreCryptoService} from '../../src/core/CoreCryptoService.js'
import {TeamsApiClient} from "../../src/api/TeamsApiClient.js";
import {ConversationRole} from "../../src/model/conversation/ConversationRole.js";
import {UserService} from "../../src/api/UserService.js";
import {CryptoProtocol} from '../../src/model/CryptoProtocol.js'

describe('ConversationService Integration', () => {
  let testDbService: TestDatabaseService
  let conversationService: ConversationService
  let conversationRepository: ConversationRepository
  let conversationMemberRepository: ConversationMemberRepository
  let mockConversationsApiClient: ConversationsApiClient
  let mockTeamsApiClient: TeamsApiClient
  let mockAppProperties: AppProperties
  let mockCoreCryptoService: CoreCryptoService
  let mockUserService: UserService

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

    mockTeamsApiClient = {
      deleteConversation: vi.fn()
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

    mockUserService = {
      getUsersClientIds: vi.fn()
    } as any

    conversationService = new ConversationService(
      SELF_USER_ID.id,
      SELF_USER_ID.domain,
      mockTeamsApiClient,
      mockConversationsApiClient,
      conversationRepository,
      conversationMemberRepository,
      mockAppProperties,
      mockCoreCryptoService,
      mockUserService
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
      expect((savedConversation as ConversationEntity).teamId).toBe(TEAM_ID)
      expect((savedConversation as ConversationEntity).mlsGroupId).toBe(MLS_GROUP_ID)

      const savedMembers = conversationService.getMembersByConversationId(CONVERSATION_ID)

      expect(savedMembers).toHaveLength(2)
      expect(savedMembers.map(member => member.userId.id)).toContain(USER_ID.id)
      expect(savedMembers.map(member => member.userId.domain)).toContain(USER_ID.domain)
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

    it('calls deleteAllConversationDataFromLocalStorages when wire user is in userIds', async () => {
      const wipeSpy = vi
        .spyOn(conversationService as any, 'deleteAllConversationDataFromLocalStorages')
        .mockResolvedValue(undefined)

      await conversationService.syncMembersRemoved([SELF_USER_ID, USER_3_ID], CONVERSATION_ID)

      expect(wipeSpy).toHaveBeenCalledWith(CONVERSATION_ID)

      wipeSpy.mockRestore()
    })

    it('does not call deleteAllConversationDataFromLocalStorages when wire user is not in userIds', async () => {
      const wipeSpy = vi
        .spyOn(conversationService as any, 'deleteAllConversationDataFromLocalStorages')
        .mockResolvedValue(undefined)

      await conversationService.syncMembersRemoved([USER_3_ID, USER_4_ID], CONVERSATION_ID)

      expect(wipeSpy).not.toHaveBeenCalled()

      wipeSpy.mockRestore()
    })
  })

  describe('deleteConversation', () => {
    beforeEach(async () => {
      // Save a conversation where SELF user is admin
      await conversationService.saveConversationWithMembers(
        CONVERSATION_ID,
        CONVERSATION_RESPONSE
      )
    })

    it('should delete conversation via Teams API and remove local data when user is admin', async () => {
      // ensure SELF user is admin (already wire_admin in CONVERSATION_RESPONSE)
      const deleteSpy = vi.spyOn(mockTeamsApiClient, 'deleteConversation').mockResolvedValue(undefined)

      const wipeSpy = vi
        .spyOn(conversationService as any, 'deleteAllConversationDataFromLocalStorages')
        .mockResolvedValue(undefined)

      await conversationService.deleteConversation(CONVERSATION_ID)

      // verify API call
      expect(deleteSpy).toHaveBeenCalledTimes(1)
      expect(deleteSpy).toHaveBeenCalledWith(
        expect.any(Object), // TeamId instance
        CONVERSATION_ID
      )

      // verify local cleanup
      expect(wipeSpy).toHaveBeenCalledWith(CONVERSATION_ID)

      deleteSpy.mockRestore()
      wipeSpy.mockRestore()
    })

    it('should throw error when user is not admin', async () => {
      // overwrite members so SELF is NOT admin
      testDbService.clearData()

      const nonAdminResponse: ConversationResponse = {
        ...CONVERSATION_RESPONSE,
        members: {
          others: [
            {
              qualified_id: USER_ID,
              conversation_role: 'wire_member'
            }
          ],
          self: {
            qualified_id: SELF_USER_ID,
            conversation_role: 'wire_member' // NOT admin
          }
        }
      } as ConversationResponse

      await conversationService.saveConversationWithMembers(CONVERSATION_ID, nonAdminResponse)

      await expect(
        conversationService.deleteConversation(CONVERSATION_ID)
      ).rejects.toThrow("App user is not an admin in the conversation.")
    })

    it('should throw error when conversation is not GROUP', async () => {
      testDbService.clearData()

      const oneToOneResponse: ConversationResponse = {
        ...ONE_TO_ONE_CONVERSATION_RESPONSE
      }

      await conversationService.saveConversationWithMembers(CONVERSATION_ID, oneToOneResponse)

      await expect(
        conversationService.deleteConversation(CONVERSATION_ID)
      ).rejects.toThrow("Conversation type is not GROUP.")
    })
  })

  describe('addMembersToConversation', () => {
    beforeEach(async () => {
      ;(mockCoreCryptoService as any).addClientsToMlsConversation = vi.fn()
      await conversationService.saveConversationWithMembers(CONVERSATION_ID, CONVERSATION_RESPONSE)
    })

    it('should throw when members list is empty', async () => {
      await expect(
        conversationService.addMembersToConversation(CONVERSATION_ID, [])
      ).rejects.toThrow('List of members cannot be empty.')

      expect((mockCoreCryptoService as any).addClientsToMlsConversation).not.toHaveBeenCalled()
    })

    it('should throw when conversation is not a GROUP', async () => {
      testDbService.clearData()
      await conversationService.saveConversationWithMembers(CONVERSATION_ID, ONE_TO_ONE_CONVERSATION_RESPONSE)

      await expect(
        conversationService.addMembersToConversation(CONVERSATION_ID, [USER_3_ID])
      ).rejects.toThrow('Conversation type is not GROUP.')

      expect((mockCoreCryptoService as any).addClientsToMlsConversation).not.toHaveBeenCalled()
    })

    it('should throw when app user is not an admin', async () => {
      testDbService.clearData()

      const nonAdminResponse: ConversationResponse = {
        ...CONVERSATION_RESPONSE,
        members: {
          others: [
            {
              qualified_id: USER_ID,
              conversation_role: 'wire_member'
            }
          ],
          self: {
            qualified_id: SELF_USER_ID,
            conversation_role: 'wire_member'
          }
        }
      } as ConversationResponse

      await conversationService.saveConversationWithMembers(CONVERSATION_ID, nonAdminResponse)

      await expect(
        conversationService.addMembersToConversation(CONVERSATION_ID, [USER_3_ID])
      ).rejects.toThrow('App user is not an admin in the conversation.')

      expect((mockCoreCryptoService as any).addClientsToMlsConversation).not.toHaveBeenCalled()
    })

    it('should persist only membersAdded to the database', async () => {
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockResolvedValue({
        membersAdded: [USER_3_ID],
        membersFailedToAdd: [USER_4_ID]
      })

      await conversationService.addMembersToConversation(CONVERSATION_ID, [USER_3_ID, USER_4_ID])

      const members = conversationService.getMembersByConversationId(CONVERSATION_ID)
      const memberIds = members.map(member => member.userId.id)

      expect(memberIds).toContain(USER_3_ID.id)
      expect(memberIds).not.toContain(USER_4_ID.id)
    })

    it('should persist successUsers with MEMBER role', async () => {
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockResolvedValue({
        membersAdded: [USER_3_ID],
        membersFailedToAdd: []
      })

      await conversationService.addMembersToConversation(CONVERSATION_ID, [USER_3_ID])

      const members = conversationService.getMembersByConversationId(CONVERSATION_ID)
      const addedMember = members.find(member => member.userId.id === USER_3_ID.id)

      expect(addedMember).toBeDefined()
      expect(addedMember?.role).toBe(ConversationRole.MEMBER)
    })

    it('should return successUsers and failedUsers from coreCryptoService', async () => {
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockResolvedValue({
        membersAdded: [USER_3_ID],
        membersFailedToAdd: [USER_4_ID]
      })

      const result = await conversationService.addMembersToConversation(
        CONVERSATION_ID,
        [USER_3_ID, USER_4_ID]
      )

      expect(result.membersAdded).toEqual([USER_3_ID])
      expect(result.membersFailedToAdd).toEqual([USER_4_ID])
    })

    it('should not persist any members when coreCryptoService fails', async () => {
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockRejectedValue(
        new Error('MLS error')
      )

      await expect(
        conversationService.addMembersToConversation(CONVERSATION_ID, [USER_3_ID])
      ).rejects.toThrow('Unable to add members to MLS conversation: MLS error')

      const members = conversationService.getMembersByConversationId(CONVERSATION_ID)
      const memberIds = members.map(member => member.userId.id)

      expect(memberIds).not.toContain(USER_3_ID.id)
    })

    it('should preserve existing members when adding new ones', async () => {
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockResolvedValue({
        membersAdded: [USER_3_ID],
        membersFailedToAdd: []
      })

      await conversationService.addMembersToConversation(CONVERSATION_ID, [USER_3_ID])

      const members = conversationService.getMembersByConversationId(CONVERSATION_ID)
      const memberIds = members.map(member => member.userId.id)

      expect(memberIds).toContain(SELF_USER_ID.id)
      expect(memberIds).toContain(USER_ID.id)
      expect(memberIds).toContain(USER_3_ID.id)
    })
  })

  describe('updateConversationMemberRole', () => {
    beforeEach(async () => {
      ;(mockConversationsApiClient as any).updateConversationMemberRole = vi.fn()
      await conversationService.saveConversationWithMembers(CONVERSATION_ID, CONVERSATION_RESPONSE)
    })

    it('should call API and persist the updated role to the database', async () => {
      vi.mocked((mockConversationsApiClient as any).updateConversationMemberRole).mockResolvedValue(undefined)

      await conversationService.updateConversationMemberRole(CONVERSATION_ID, USER_ID, ConversationRole.ADMIN)

      expect((mockConversationsApiClient as any).updateConversationMemberRole).toHaveBeenCalledWith(
        CONVERSATION_ID,
        USER_ID,
        ConversationRole.ADMIN
      )

      const members = conversationService.getMembersByConversationId(CONVERSATION_ID)
      const updatedMember = members.find(member => member.userId.id === USER_ID.id)

      expect(updatedMember?.role).toBe(ConversationRole.ADMIN)
    })

    it('should throw when conversation is not a GROUP', async () => {
      testDbService.clearData()
      await conversationService.saveConversationWithMembers(CONVERSATION_ID, ONE_TO_ONE_CONVERSATION_RESPONSE)

      await expect(
        conversationService.updateConversationMemberRole(CONVERSATION_ID, USER_ID, ConversationRole.ADMIN)
      ).rejects.toThrow('Conversation type is not GROUP.')

      expect((mockConversationsApiClient as any).updateConversationMemberRole).not.toHaveBeenCalled()
    })

    it('should throw when app user is not an admin', async () => {
      testDbService.clearData()

      const nonAdminResponse: ConversationResponse = {
        ...CONVERSATION_RESPONSE,
        members: {
          others: [{ qualified_id: USER_ID, conversation_role: 'wire_member' }],
          self: { qualified_id: SELF_USER_ID, conversation_role: 'wire_member' }
        }
      } as ConversationResponse

      await conversationService.saveConversationWithMembers(CONVERSATION_ID, nonAdminResponse)

      await expect(
        conversationService.updateConversationMemberRole(CONVERSATION_ID, USER_ID, ConversationRole.ADMIN)
      ).rejects.toThrow('App user is not an admin in the conversation.')

      expect((mockConversationsApiClient as any).updateConversationMemberRole).not.toHaveBeenCalled()
    })

    it('should not persist the updated role when API call fails', async () => {
      vi.mocked((mockConversationsApiClient as any).updateConversationMemberRole).mockRejectedValue(new Error('update failed'))

      await expect(
        conversationService.updateConversationMemberRole(CONVERSATION_ID, USER_ID, ConversationRole.ADMIN)
      ).rejects.toThrow('update failed')

      const members = conversationService.getMembersByConversationId(CONVERSATION_ID)
      const member = members.find(member => member.userId.id === USER_ID.id)

      expect(member?.role).toBe(ConversationRole.MEMBER)
    })

    it('should preserve other members when updating one member role', async () => {
      vi.mocked((mockConversationsApiClient as any).updateConversationMemberRole).mockResolvedValue(undefined)

      await conversationService.updateConversationMemberRole(CONVERSATION_ID, USER_ID, ConversationRole.ADMIN)

      const members = conversationService.getMembersByConversationId(CONVERSATION_ID)
      const memberIds = members.map(member => member.userId.id)

      expect(memberIds).toContain(SELF_USER_ID.id)
      expect(memberIds).toContain(USER_ID.id)
    })
  })

  describe('getAllConversations', () => {
    it('should return all conversations excluding SELF type', async () => {
      const selfConversationResponse: ConversationResponse = {
        qualified_id: {id: 'self-conv-id', domain: 'wire.com'},
        type: ConversationType.SELF,
        name: 'Self Conversation',
        team: TEAM_ID,
        group_id: 'mls-self',
        members: {
          others: [],
          self: {
            qualified_id: SELF_USER_ID,
            conversation_role: 'wire_admin'
          }
        },
        protocol: CryptoProtocol.MLS,
        epoch: 0
      } as ConversationResponse

      await conversationService.saveConversationWithMembers(CONVERSATION_ID, CONVERSATION_RESPONSE)
      await conversationService.saveConversationWithMembers(OTHER_CONVERSATION_ID, OTHER_CONVERSATION_RESPONSE)
      await conversationService.saveConversationWithMembers({
        id: 'self-conv-id',
        domain: 'wire.com'
      }, selfConversationResponse)

      const result = await conversationService.getAllConversations()

      expect(result).toHaveLength(2)
      expect(result.find(conversation => conversation.type === ConversationType.SELF)).toBeUndefined()
      expect(result.find(conversation => conversation.id === CONVERSATION_ID.id)).toBeDefined()
      expect(result.find(conversation => conversation.id === OTHER_CONVERSATION_ID.id)).toBeDefined()
      expect(result.find(conversation => conversation.id === CONVERSATION_ID.id)).toEqual({
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: CONVERSATION_NAME,
        type: ConversationType.GROUP,
        teamId: TEAM_ID
      })
    })

    it('should return empty list when only SELF conversation exists', async () => {
      const selfConversationResponse: ConversationResponse = {
        qualified_id: {id: 'self-conv-id', domain: 'wire.com'},
        type: ConversationType.SELF,
        name: 'Self Conversation',
        team: TEAM_ID,
        group_id: 'mls-self',
        members: {
          others: [],
          self: {
            qualified_id: SELF_USER_ID,
            conversation_role: 'wire_admin'
          }
        },
        protocol: CryptoProtocol.MLS,
        epoch: 0
      } as ConversationResponse

      await conversationService.saveConversationWithMembers({
        id: 'self-conv-id',
        domain: 'wire.com'
      }, selfConversationResponse)

      const result = await conversationService.getAllConversations()

      expect(result).toHaveLength(0)
    })

    it('should return empty list when there are no conversations', async () => {
      const result = await conversationService.getAllConversations()

      expect(result).toHaveLength(0)
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
