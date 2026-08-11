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

import {beforeEach, describe, expect, it, vi} from 'vitest'
import {ConversationService} from '../../src/api/ConversationService.js'
import {ConversationsApiClient} from '../../src/api/ConversationsApiClient.js'
import {ConversationRepository} from '../../src/db/ConversationRepository.js'
import {ConversationMemberRepository} from '../../src/db/ConversationMemberRepository.js'
import {ConversationType} from '../../src/model/conversation/ConversationType.js'
import {QualifiedId} from '../../src/model/QualifiedId.js'
import type {ConversationResponse} from '../../src/api/response/ConversationResponse.js'
import type {ConversationEntity} from '../../src/db/model/ConversationEntity.js'
import {container} from 'tsyringe'
import {AppProperties} from '../../src/service/AppProperties.js'
import {CoreCryptoService} from '../../src/core/CoreCryptoService.js'
import {CryptoProtocol} from '../../src/model/CryptoProtocol.js'
import {ConversationRole} from '../../src/model/conversation/ConversationRole.js'
import {TeamsApiClient} from '../../src/api/TeamsApiClient.js'
import {TeamId} from '../../src/model/TeamId.js'
import {UserService} from '../../src/api/UserService.js'
import {CryptoClientId} from '../../src/model/CryptoClientId.js'
import type {OneToOneConversationsApiClient} from '../../src/api/OneToOneConversationsApiClient.js'
import type {OneToOneConversationResponse} from '../../src/api/response/OneToOneConversationResponse.js'

describe('ConversationService', () => {
  let conversationService: ConversationService
  let mockTeamsApiClient: TeamsApiClient
  let mockConversationsApiClient: ConversationsApiClient
  let mockOneToOneConversationsApiClient: OneToOneConversationsApiClient
  let mockConversationRepository: ConversationRepository
  let mockConversationMemberRepository: ConversationMemberRepository
  let mockAppProperties: AppProperties
  let mockCoreCryptoService: CoreCryptoService
  let mockUserService: UserService

  beforeEach(() => {
    container.clearInstances()

    mockTeamsApiClient = {
      deleteConversation: vi.fn()
    } as any

    mockConversationsApiClient = {
      getConversation: vi.fn(),
      getConversationGroupInfo: vi.fn(),
      getAllConversationIds: vi.fn(),
      getConversationsById: vi.fn(),
      leaveConversation: vi.fn()
    } as any

    mockOneToOneConversationsApiClient = {
      getOneToOneConversation: vi.fn()
    } as any

    mockConversationRepository = {
      save: vi.fn(),
      findByIdAndDomain: vi.fn(),
      findOneToOneByNameAndDomain: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn()
    } as any

    mockConversationMemberRepository = {
      saveMany: vi.fn(),
      getMembersByConversationId: vi.fn(),
      deleteAllMembersInConversation: vi.fn(),
      deleteMany: vi.fn(),
      exists: vi.fn()
    } as any

    mockAppProperties = {
      getShouldRejoinConversations: vi.fn(),
      setShouldRejoinConversations: vi.fn()
    } as any

    mockCoreCryptoService = {
      conversationExists: vi.fn(),
      joinMlsConversation: vi.fn(),
      establishMlsConversation: vi.fn(),
      wipeConversation: vi.fn(),
      removeClientsFromMlsConversation: vi.fn(),
      addClientsToMlsConversation: vi.fn()
    } as any

    mockUserService = {
      getUser: vi.fn(),
      getUsersClientIds: vi.fn()
    } as any

    conversationService = new ConversationService(
      SELF_USER_ID.id,
      SELF_USER_ID.domain,
      mockTeamsApiClient,
      mockConversationsApiClient,
      mockOneToOneConversationsApiClient,
      mockConversationRepository,
      mockConversationMemberRepository,
      mockAppProperties,
      mockCoreCryptoService,
      mockUserService
    )

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
        epoch: 0,
        protocol: CryptoProtocol.MLS,
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

      const result = await conversationService.saveConversationWithMembers(CONVERSATION_ID, conversationResponse)

      expect(mockConversationRepository.save).toHaveBeenCalledWith({
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: `${USER_ID.id}@${USER_ID.domain}`,
        teamId: TEAM_ID,
        mlsGroupId: MLS_GROUP_ID,
        creationDate: null,
        type: ConversationType.ONE_TO_ONE
      })

      expect(mockConversationMemberRepository.saveMany).toHaveBeenCalledWith([
        {
          userId: SELF_USER_ID.id,
          userDomain: SELF_USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: 'wire_admin',
          creationDate: null
        },
        {
          userId: USER_ID.id,
          userDomain: USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: 'wire_member',
          creationDate: null
        }
      ])

      expect(result.conversation.name).toBe(`${USER_ID.id}@${USER_ID.domain}`)
      expect(result.members).toHaveLength(2)
    })

    it('should save GROUP conversation with conversation name', async () => {
      const conversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.GROUP,
        name: 'Test Conversation',
        team: TEAM_ID,
        group_id: MLS_GROUP_ID,
        epoch: 0,
        protocol: CryptoProtocol.MLS,
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

      const result = await conversationService.saveConversationWithMembers(CONVERSATION_ID, conversationResponse)

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
        epoch: 0,
        protocol: CryptoProtocol.MLS,
        members: {
          others: [],
          self: {
            qualified_id: SELF_USER_ID,
            conversation_role: 'wire_admin'
          }
        }
      } as ConversationResponse

      const result = await conversationService.saveConversationWithMembers(CONVERSATION_ID, conversationResponse)

      expect(result.conversation.name).toBe('')
    })
  })

  describe('getConversationById', () => {
    it('should return conversation from database when it exists', async () => {
      const mockConversationEntity: ConversationEntity = {
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Existing Conversation',
        teamId: TEAM_ID,
        mlsGroupId: MLS_GROUP_ID,
        creationDate: null,
        type: ConversationType.GROUP
      }

      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(mockConversationEntity)

      const result = await conversationService.getConversationById(CONVERSATION_ID)

      expect(mockConversationRepository.findByIdAndDomain).toHaveBeenCalledWith(
        CONVERSATION_ID.id,
        CONVERSATION_ID.domain
      )
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

      expect(mockConversationRepository.findByIdAndDomain).toHaveBeenCalledWith(
        CONVERSATION_ID.id,
        CONVERSATION_ID.domain
      )
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
        epoch: 0,
        protocol: CryptoProtocol.MLS,
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
    it('should return mlsGroupId from conversation', async () => {
      const mockConversationEntity: ConversationEntity = {
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Test Conversation',
        teamId: TEAM_ID,
        mlsGroupId: MLS_GROUP_ID,
        creationDate: null,
        type: ConversationType.GROUP
      }

      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(mockConversationEntity)

      const result = await conversationService.getConversationMLSGroupId(CONVERSATION_ID)

      expect(result).toBe(MLS_GROUP_ID)
    })
  })

  describe('getMembersByConversationId', () => {
    it('returns members from repository', () => {
      const memberEntities = [
        {
          userId: 'a',
          userDomain: 'wire.com',
          conversationId: 'c',
          conversationDomain: 'wire.com',
          role: 'wire_member',
          creationDate: null
        }
      ]

      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue(memberEntities)

      const result = conversationService.getMembersByConversationId(CONVERSATION_ID)

      expect(mockConversationMemberRepository.getMembersByConversationId).toHaveBeenCalledWith(
        CONVERSATION_ID.id,
        CONVERSATION_ID.domain
      )
      expect(result).toEqual([
        {
          userId: {id: 'a', domain: 'wire.com'},
          role: ConversationRole.MEMBER
        }
      ])
    })
  })

  describe('deleteAllConversationDataFromLocalStorages', () => {
    it('wipes crypto when exists then deletes members and conversation', async () => {
      const mockConversationEntity: ConversationEntity = {
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Test Conversation',
        teamId: TEAM_ID,
        mlsGroupId: MLS_GROUP_ID,
        creationDate: null,
        type: ConversationType.GROUP
      }

      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(mockConversationEntity)
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)
      vi.mocked(mockCoreCryptoService.wipeConversation).mockResolvedValue(undefined)

      await conversationService.deleteAllConversationDataFromLocalStorages(CONVERSATION_ID)

      expect(mockConversationRepository.findByIdAndDomain).toHaveBeenCalledWith(
        CONVERSATION_ID.id,
        CONVERSATION_ID.domain
      )
      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockCoreCryptoService.wipeConversation).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationMemberRepository.deleteAllMembersInConversation).toHaveBeenCalledWith(
        CONVERSATION_ID.id,
        CONVERSATION_ID.domain
      )
      expect(mockConversationRepository.delete).toHaveBeenCalledWith(CONVERSATION_ID.id, CONVERSATION_ID.domain)
    })

    it('skips crypto wipe when conversation does not exist and still deletes DB data', async () => {
      const mockConversationEntity: ConversationEntity = {
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Test Conversation',
        teamId: TEAM_ID,
        mlsGroupId: MLS_GROUP_ID,
        creationDate: null,
        type: ConversationType.GROUP
      }

      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(mockConversationEntity)
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)

      await conversationService.deleteAllConversationDataFromLocalStorages(CONVERSATION_ID)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockCoreCryptoService.wipeConversation).not.toHaveBeenCalled()
      expect(mockConversationMemberRepository.deleteAllMembersInConversation).toHaveBeenCalledWith(
        CONVERSATION_ID.id,
        CONVERSATION_ID.domain
      )
      expect(mockConversationRepository.delete).toHaveBeenCalledWith(CONVERSATION_ID.id, CONVERSATION_ID.domain)
    })

    it('propagates error when wipeConversation fails and does not perform DB deletes', async () => {
      const mockConversationEntity: ConversationEntity = {
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Test Conversation',
        teamId: TEAM_ID,
        mlsGroupId: MLS_GROUP_ID,
        creationDate: null,
        type: ConversationType.GROUP
      }

      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(mockConversationEntity)
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)
      vi.mocked(mockCoreCryptoService.wipeConversation).mockRejectedValue(new Error('wipe failed'))

      await expect(conversationService.deleteAllConversationDataFromLocalStorages(CONVERSATION_ID)).rejects.toThrow(
        'wipe failed'
      )

      expect(mockConversationMemberRepository.deleteAllMembersInConversation).not.toHaveBeenCalled()
      expect(mockConversationRepository.delete).not.toHaveBeenCalled()
    })
  })

  describe('resetMlsConversation', () => {
    const NEW_GROUP_ID = 'new-mls-group-id-5678'

    it('wipes old group from crypto and deletes conversation from local storage', async () => {
      const mockConversationEntity: ConversationEntity = {
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Test Conversation',
        teamId: TEAM_ID,
        mlsGroupId: MLS_GROUP_ID,
        creationDate: null,
        type: ConversationType.GROUP
      }

      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(mockConversationEntity)
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)
      vi.mocked(mockCoreCryptoService.wipeConversation).mockResolvedValue(undefined)

      await conversationService.resetMlsConversation(CONVERSATION_ID, NEW_GROUP_ID)

      expect(mockCoreCryptoService.wipeConversation).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationMemberRepository.deleteAllMembersInConversation).toHaveBeenCalledWith(
        CONVERSATION_ID.id,
        CONVERSATION_ID.domain
      )
      expect(mockConversationRepository.delete).toHaveBeenCalledWith(CONVERSATION_ID.id, CONVERSATION_ID.domain)
    })

    it('skips wipe but still deletes from storage when crypto group does not exist', async () => {
      const mockConversationEntity: ConversationEntity = {
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Test Conversation',
        teamId: TEAM_ID,
        mlsGroupId: MLS_GROUP_ID,
        creationDate: null,
        type: ConversationType.GROUP
      }

      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(mockConversationEntity)
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)

      await conversationService.resetMlsConversation(CONVERSATION_ID, NEW_GROUP_ID)

      expect(mockCoreCryptoService.wipeConversation).not.toHaveBeenCalled()
      expect(mockConversationMemberRepository.deleteAllMembersInConversation).toHaveBeenCalledWith(
        CONVERSATION_ID.id,
        CONVERSATION_ID.domain
      )
      expect(mockConversationRepository.delete).toHaveBeenCalledWith(CONVERSATION_ID.id, CONVERSATION_ID.domain)
    })

    it('is idempotent and skips reset when conversation already has the new groupId', async () => {
      const mockConversationEntity: ConversationEntity = {
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Test Conversation',
        teamId: TEAM_ID,
        mlsGroupId: NEW_GROUP_ID,
        creationDate: null,
        type: ConversationType.GROUP
      }

      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(mockConversationEntity)

      await conversationService.resetMlsConversation(CONVERSATION_ID, NEW_GROUP_ID)

      expect(mockCoreCryptoService.conversationExists).not.toHaveBeenCalled()
      expect(mockCoreCryptoService.wipeConversation).not.toHaveBeenCalled()
      expect(mockConversationMemberRepository.deleteAllMembersInConversation).not.toHaveBeenCalled()
      expect(mockConversationRepository.delete).not.toHaveBeenCalled()
    })

    it('returns early without deleting when conversation is not found in storage', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(null)

      await conversationService.resetMlsConversation(CONVERSATION_ID, NEW_GROUP_ID)

      expect(mockCoreCryptoService.conversationExists).not.toHaveBeenCalled()
      expect(mockCoreCryptoService.wipeConversation).not.toHaveBeenCalled()
      expect(mockConversationMemberRepository.deleteAllMembersInConversation).not.toHaveBeenCalled()
      expect(mockConversationRepository.delete).not.toHaveBeenCalled()
    })
  })

  describe('fetchEpoch', () => {
    it('should return epoch from conversationsApiClient', async () => {
      const mockEpoch = 42
      vi.mocked(mockConversationsApiClient.getConversation).mockResolvedValue({epoch: mockEpoch} as any)

      const result = await conversationService.fetchEpoch(CONVERSATION_ID)

      expect(mockConversationsApiClient.getConversation).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(result).toBe(mockEpoch)
    })
  })

  describe('getConversationGroupInfo', () => {
    it('should call api client and return bytes', async () => {
      const mockBytes = new Uint8Array([1, 2, 3])
      ;(mockConversationsApiClient as any).getConversationGroupInfo = vi.fn().mockResolvedValue(mockBytes)

      const result = await conversationService.getConversationGroupInfo(CONVERSATION_ID)

      expect((mockConversationsApiClient as any).getConversationGroupInfo).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(result).toEqual(mockBytes)
    })
  })

  describe('addMembers', () => {
    it('should map members and call saveMany on repository', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue({
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Existing Conversation',
        teamId: TEAM_ID,
        mlsGroupId: MLS_GROUP_ID,
        creationDate: null,
        type: ConversationType.GROUP
      } as any)

      const members = [
        {userId: USER_ID, role: 'wire_member'},
        {userId: SELF_USER_ID, role: 'wire_admin'}
      ] as any

      await conversationService.syncMembersAdded(members, CONVERSATION_ID)

      expect(mockConversationMemberRepository.saveMany).toHaveBeenCalledWith([
        {
          userId: USER_ID.id,
          userDomain: USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: 'wire_member',
          creationDate: null
        },
        {
          userId: SELF_USER_ID.id,
          userDomain: SELF_USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: 'wire_admin',
          creationDate: null
        }
      ])
    })
  })

  describe('establishOrRejoinConversations', () => {
    it('should skip re-joining when shouldRejoinConversations is false', async () => {
      vi.mocked(mockAppProperties.getShouldRejoinConversations).mockReturnValue(false)

      await conversationService.establishOrRejoinConversations()

      expect(mockAppProperties.getShouldRejoinConversations).toHaveBeenCalled()
      expect(mockConversationsApiClient.getAllConversationIds).not.toHaveBeenCalled()
      expect(mockAppProperties.setShouldRejoinConversations).not.toHaveBeenCalled()
    })

    it('should process MLS conversations when shouldRejoinConversations is true', async () => {
      vi.mocked(mockAppProperties.getShouldRejoinConversations).mockReturnValue(true)

      const conversationIds = [CONVERSATION_ID, {...CONVERSATION_ID, id: 'conv-2'}]
      const conversations: ConversationResponse[] = [
        {
          qualified_id: CONVERSATION_ID,
          type: ConversationType.GROUP,
          name: 'MLS Conversation',
          team: TEAM_ID,
          protocol: CryptoProtocol.MLS,
          group_id: MLS_GROUP_ID,
          epoch: 0,
          members: {
            others: [],
            self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
          }
        } as ConversationResponse,
        {
          qualified_id: {...CONVERSATION_ID, id: 'conv-2'},
          type: ConversationType.GROUP,
          name: 'Proteus Conversation',
          team: TEAM_ID,
          protocol: CryptoProtocol.PROTEUS, // Non-MLS conversation
          group_id: 'mls-group-2',
          epoch: 0,
          members: {
            others: [],
            self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
          }
        } as ConversationResponse
      ]

      vi.mocked(mockConversationsApiClient.getAllConversationIds).mockResolvedValue(conversationIds)
      vi.mocked(mockConversationsApiClient.getConversationsById).mockResolvedValue(conversations)
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)

      await conversationService.establishOrRejoinConversations()

      expect(mockConversationsApiClient.getAllConversationIds).toHaveBeenCalled()
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenCalledWith(conversationIds)
      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledTimes(1) // Only for MLS conversation
      expect(mockAppProperties.setShouldRejoinConversations).toHaveBeenCalledWith(false)
    })

    it('should process multiple MLS conversations', async () => {
      vi.mocked(mockAppProperties.getShouldRejoinConversations).mockReturnValue(true)

      const conversationIds = [CONVERSATION_ID, {...CONVERSATION_ID, id: 'conv-2'}]
      const conversations: ConversationResponse[] = [
        {
          qualified_id: CONVERSATION_ID,
          type: ConversationType.GROUP,
          name: 'MLS Conversation',
          team: TEAM_ID,
          protocol: CryptoProtocol.MLS,
          group_id: MLS_GROUP_ID,
          epoch: 5,
          members: {
            others: [],
            self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
          }
        } as ConversationResponse,
        {
          qualified_id: {...CONVERSATION_ID, id: 'conv-2'},
          type: ConversationType.SELF,
          name: null,
          team: TEAM_ID,
          protocol: CryptoProtocol.MLS,
          group_id: 'mls-group-2',
          epoch: 0,
          members: {
            others: [],
            self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
          }
        } as ConversationResponse
      ]

      const mockGroupInfoBytes = new Uint8Array([1, 2, 3])

      vi.mocked(mockConversationsApiClient.getAllConversationIds).mockResolvedValue(conversationIds)
      vi.mocked(mockConversationsApiClient.getConversationsById).mockResolvedValue(conversations)
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)
      vi.mocked(mockConversationsApiClient.getConversationGroupInfo).mockResolvedValue(mockGroupInfoBytes)

      await conversationService.establishOrRejoinConversations()

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledTimes(2)
      expect(mockCoreCryptoService.joinMlsConversation).toHaveBeenCalledWith(mockGroupInfoBytes)
      expect(mockCoreCryptoService.establishMlsConversation).toHaveBeenCalledWith('mls-group-2')
      expect(mockAppProperties.setShouldRejoinConversations).toHaveBeenCalledWith(false)
    })
  })

  describe('establishOrJoinMlsConversation', () => {
    it('should skip conversation when it already exists', async () => {
      const conversation: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.GROUP,
        name: 'Existing Conversation',
        team: TEAM_ID,
        protocol: CryptoProtocol.MLS,
        group_id: MLS_GROUP_ID,
        epoch: 5,
        members: {
          others: [],
          self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
        }
      } as ConversationResponse

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)

      // Call the private method via the public one
      await (conversationService as any).establishOrJoinMlsConversation(conversation)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockCoreCryptoService.joinMlsConversation).not.toHaveBeenCalled()
      expect(mockCoreCryptoService.establishMlsConversation).not.toHaveBeenCalled()
    })

    it('should join conversation when epoch is non-zero and save conversation with members', async () => {
      const conversation: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.GROUP,
        protocol: CryptoProtocol.MLS,
        group_id: MLS_GROUP_ID,
        epoch: 5,
        name: 'Rejoined Conversation',
        team: TEAM_ID,
        members: {
          others: [{qualified_id: USER_ID, conversation_role: 'wire_member'}],
          self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
        }
      } as ConversationResponse

      const mockGroupInfoBytes = new Uint8Array([1, 2, 3])

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)
      vi.mocked(mockConversationsApiClient.getConversationGroupInfo).mockResolvedValue(mockGroupInfoBytes)

      await (conversationService as any).establishOrJoinMlsConversation(conversation)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationsApiClient.getConversationGroupInfo).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(mockCoreCryptoService.joinMlsConversation).toHaveBeenCalledWith(mockGroupInfoBytes)
      expect(mockCoreCryptoService.establishMlsConversation).not.toHaveBeenCalled()

      // Verify conversation and members are saved locally after joining
      expect(mockConversationRepository.save).toHaveBeenCalledWith({
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Rejoined Conversation',
        teamId: TEAM_ID,
        mlsGroupId: MLS_GROUP_ID,
        creationDate: null,
        type: ConversationType.GROUP
      })
      expect(mockConversationMemberRepository.saveMany).toHaveBeenCalledWith([
        {
          userId: SELF_USER_ID.id,
          userDomain: SELF_USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: 'wire_admin',
          creationDate: null
        },
        {
          userId: USER_ID.id,
          userDomain: USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: 'wire_member',
          creationDate: null
        }
      ])
    })

    it('should establish SELF conversation when epoch is zero', async () => {
      const conversation: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.SELF,
        name: null,
        team: TEAM_ID,
        protocol: CryptoProtocol.MLS,
        group_id: MLS_GROUP_ID,
        epoch: 0,
        members: {
          others: [],
          self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
        }
      } as ConversationResponse

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)

      await (conversationService as any).establishOrJoinMlsConversation(conversation)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockCoreCryptoService.establishMlsConversation).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationsApiClient.getConversationGroupInfo).not.toHaveBeenCalled()
      expect(mockCoreCryptoService.joinMlsConversation).not.toHaveBeenCalled()
    })

    it('should not join or establish when epoch is null and type is not SELF', async () => {
      const conversation: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.GROUP,
        name: 'Null Epoch Conversation',
        team: TEAM_ID,
        protocol: CryptoProtocol.MLS,
        group_id: MLS_GROUP_ID,
        epoch: null,
        members: {
          others: [],
          self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
        }
      } as ConversationResponse

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)

      await (conversationService as any).establishOrJoinMlsConversation(conversation)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockCoreCryptoService.joinMlsConversation).not.toHaveBeenCalled()
      expect(mockCoreCryptoService.establishMlsConversation).not.toHaveBeenCalled()
    })
  })

  describe('establishOrRejoinConversations - batch processing', () => {
    it('should process 2500 conversations in multiple batches', async () => {
      vi.mocked(mockAppProperties.getShouldRejoinConversations).mockReturnValue(true)

      // Generate 2500 conversation IDs
      const conversationIds = Array.from({length: 2500}, (_, i) => ({
        id: `conv-${i}`,
        domain: 'wire.com'
      }))

      // Mock API to return MLS conversations for all batches
      vi.mocked(mockConversationsApiClient.getAllConversationIds).mockResolvedValue(conversationIds)
      vi.mocked(mockConversationsApiClient.getConversationsById).mockImplementation(async (ids) => {
        return ids.map(
          (id) =>
            ({
              qualified_id: id,
              type: ConversationType.GROUP,
              name: `Conversation ${id.id}`,
              team: TEAM_ID,
              protocol: CryptoProtocol.MLS,
              group_id: `mls-${id.id}`,
              epoch: 5,
              members: {
                others: [],
                self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
              }
            }) as ConversationResponse
        )
      })

      const mockGroupInfoBytes = new Uint8Array([1, 2, 3])
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)
      vi.mocked(mockConversationsApiClient.getConversationGroupInfo).mockResolvedValue(mockGroupInfoBytes)

      await conversationService.establishOrRejoinConversations()

      // Should be called 3 times: batches of 1000, 1000, and 500
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenCalledTimes(3)
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenNthCalledWith(1, conversationIds.slice(0, 1000))
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenNthCalledWith(
        2,
        conversationIds.slice(1000, 2000)
      )
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenNthCalledWith(
        3,
        conversationIds.slice(2000, 2500)
      )

      // Should process all 2500 MLS conversations
      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledTimes(2500)
      expect(mockAppProperties.setShouldRejoinConversations).toHaveBeenCalledWith(false)
    })

    it('should process exactly 3000 conversations in 3 equal batches', async () => {
      vi.mocked(mockAppProperties.getShouldRejoinConversations).mockReturnValue(true)

      const conversationIds = Array.from({length: 3000}, (_, i) => ({
        id: `conv-${i}`,
        domain: 'wire.com'
      }))

      vi.mocked(mockConversationsApiClient.getAllConversationIds).mockResolvedValue(conversationIds)
      vi.mocked(mockConversationsApiClient.getConversationsById).mockImplementation(async (ids) => {
        // Return mix of MLS and non-MLS (50/50 split)
        return ids.map(
          (id, idx) =>
            ({
              qualified_id: id,
              type: ConversationType.GROUP,
              name: `Conversation ${id.id}`,
              team: TEAM_ID,
              protocol: idx % 2 === 0 ? CryptoProtocol.MLS : CryptoProtocol.PROTEUS,
              group_id: `mls-${id.id}`,
              epoch: 0,
              members: {
                others: [],
                self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
              }
            }) as ConversationResponse
        )
      })

      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)

      await conversationService.establishOrRejoinConversations()

      // Should be called 3 times with exactly 1000 conversations each
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenCalledTimes(3)
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenNthCalledWith(1, conversationIds.slice(0, 1000))
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenNthCalledWith(
        2,
        conversationIds.slice(1000, 2000)
      )
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenNthCalledWith(
        3,
        conversationIds.slice(2000, 3000)
      )

      // Should only process 1500 MLS conversations (50% of 3000)
      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledTimes(1500)
    })
  })

  describe('removeMembers', () => {
    beforeEach(() => {
      // ensure conversation exists locally
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue({
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Existing Conversation',
        team_id: TEAM_ID,
        mls_group_id: MLS_GROUP_ID,
        creation_date: null,
        type: ConversationType.GROUP
      } as any)

      // ensure deleteMany is available on the mock for tests that expect it
      ;(mockConversationMemberRepository as any).deleteMany = vi.fn()
    })

    it('calls deleteAllConversationDataFromLocalStorages when wire user is in userIds', async () => {
      const wipeSpy = vi
        .spyOn(conversationService as any, 'deleteAllConversationDataFromLocalStorages')
        .mockResolvedValue(undefined)

      await conversationService.syncMembersRemoved([SELF_USER_ID], CONVERSATION_ID)

      expect(wipeSpy).toHaveBeenCalledWith(CONVERSATION_ID)

      wipeSpy.mockRestore()
    })

    it('calls repository.deleteMany and does not call wipe when wire user is not in userIds', async () => {
      const wipeSpy = vi
        .spyOn(conversationService as any, 'deleteAllConversationDataFromLocalStorages')
        .mockResolvedValue(undefined)

      await conversationService.syncMembersRemoved([USER_ID], CONVERSATION_ID)

      expect((mockConversationMemberRepository as any).deleteMany).toHaveBeenCalledWith(
        [USER_ID],
        CONVERSATION_ID.id,
        CONVERSATION_ID.domain
      )

      expect(wipeSpy).not.toHaveBeenCalled()

      wipeSpy.mockRestore()
    })
  })

  describe('updateMember', () => {
    it('skips updating when conversation does not exist locally', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(null)
      ;(mockConversationMemberRepository as any).save = vi.fn()

      const newRole: ConversationRole = ConversationRole.ADMIN
      await conversationService.syncMemberUpdate(USER_ID, CONVERSATION_ID, newRole)

      expect((mockConversationMemberRepository as any).save).not.toHaveBeenCalled()
    })

    it('updates member role when conversation exists', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue({} as any)
      ;(mockConversationMemberRepository as any).save = vi.fn()

      const newRole: ConversationRole = ConversationRole.ADMIN
      await conversationService.syncMemberUpdate(USER_ID, CONVERSATION_ID, newRole)

      expect((mockConversationMemberRepository as any).save).toHaveBeenCalledWith({
        userId: USER_ID.id,
        userDomain: USER_ID.domain,
        conversationId: CONVERSATION_ID.id,
        conversationDomain: CONVERSATION_ID.domain,
        role: newRole,
        creationDate: null
      })
    })
  })

  describe('leaveConversation', () => {
    it('should not call API for non-group conversation', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue({
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'One-to-one',
        team_id: TEAM_ID,
        mls_group_id: null,
        creation_date: null,
        type: ConversationType.ONE_TO_ONE
      } as any)

      await conversationService.leaveConversation(CONVERSATION_ID)

      expect(mockConversationRepository.findByIdAndDomain).toHaveBeenCalledWith(
        CONVERSATION_ID.id,
        CONVERSATION_ID.domain
      )
      expect(mockConversationsApiClient.leaveConversation).not.toHaveBeenCalled()
    })

    it('should not call API when app user is not a member', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue({
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Group',
        team_id: TEAM_ID,
        mls_group_id: MLS_GROUP_ID,
        creation_date: null,
        type: ConversationType.GROUP
      } as any)

      // members do not include the app user
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([
        {
          userId: USER_ID.id,
          userDomain: USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: 'wire_member',
          creationDate: null
        }
      ])

      await conversationService.leaveConversation(CONVERSATION_ID)

      expect(mockConversationMemberRepository.getMembersByConversationId).toHaveBeenCalledWith(
        CONVERSATION_ID.id,
        CONVERSATION_ID.domain
      )
      expect(mockConversationsApiClient.leaveConversation).not.toHaveBeenCalled()
    })

    it('should call API and delete local data when app user is a member', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue({
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Group',
        team_id: TEAM_ID,
        mls_group_id: MLS_GROUP_ID,
        creation_date: null,
        type: ConversationType.GROUP
      } as any)

      // include app user in members
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([
        {
          userId: SELF_USER_ID.id,
          userDomain: SELF_USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: 'wire_admin',
          creationDate: null
        }
      ])

      vi.mocked(mockConversationsApiClient.leaveConversation).mockResolvedValue(undefined)
      const wipeSpy = vi
        .spyOn(conversationService as any, 'deleteAllConversationDataFromLocalStorages')
        .mockResolvedValue(undefined)

      await conversationService.leaveConversation(CONVERSATION_ID)

      expect(mockConversationsApiClient.leaveConversation).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(wipeSpy).toHaveBeenCalledWith(CONVERSATION_ID)

      wipeSpy.mockRestore()
    })

    it('should propagate error from API and not delete local data', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue({
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: 'Group',
        team_id: TEAM_ID,
        mls_group_id: MLS_GROUP_ID,
        creation_date: null,
        type: ConversationType.GROUP
      } as any)

      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([
        {
          userId: SELF_USER_ID.id,
          userDomain: SELF_USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: 'wire_admin',
          creationDate: null
        }
      ])

      vi.mocked(mockConversationsApiClient.leaveConversation).mockRejectedValue(new Error('leave failed'))
      const wipeSpy = vi
        .spyOn(conversationService as any, 'deleteAllConversationDataFromLocalStorages')
        .mockResolvedValue(undefined)

      await expect(conversationService.leaveConversation(CONVERSATION_ID)).rejects.toThrow('leave failed')

      expect(mockConversationsApiClient.leaveConversation).toHaveBeenCalledWith(CONVERSATION_ID)
      expect(wipeSpy).not.toHaveBeenCalled()

      wipeSpy.mockRestore()
    })
  })

  describe('deleteConversation', () => {
    const groupConversationEntity: ConversationEntity = {
      id: CONVERSATION_ID.id,
      domain: CONVERSATION_ID.domain,
      name: 'Group Conversation',
      teamId: TEAM_ID,
      mlsGroupId: MLS_GROUP_ID,
      creationDate: null,
      type: ConversationType.GROUP
    }

    const adminMember = {
      userId: SELF_USER_ID.id,
      userDomain: SELF_USER_ID.domain,
      conversationId: CONVERSATION_ID.id,
      conversationDomain: CONVERSATION_ID.domain,
      role: ConversationRole.ADMIN,
      creationDate: null
    }

    it('should delete conversation when all conditions are met', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(groupConversationEntity)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([adminMember])
      vi.mocked(mockTeamsApiClient.deleteConversation).mockResolvedValue(undefined)
      const wipeSpy = vi
        .spyOn(conversationService as any, 'deleteAllConversationDataFromLocalStorages')
        .mockResolvedValue(undefined)

      await conversationService.deleteConversation(CONVERSATION_ID)

      expect(mockTeamsApiClient.deleteConversation).toHaveBeenCalledWith(new TeamId(TEAM_ID), CONVERSATION_ID)
      expect(wipeSpy).toHaveBeenCalledWith(CONVERSATION_ID)

      wipeSpy.mockRestore()
    })

    it('should throw when conversation is not a GROUP', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue({
        ...groupConversationEntity,
        type: ConversationType.ONE_TO_ONE
      })
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([adminMember])

      await expect(conversationService.deleteConversation(CONVERSATION_ID)).rejects.toThrow()

      expect(mockTeamsApiClient.deleteConversation).not.toHaveBeenCalled()
    })

    it('should throw when team_id is null', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue({
        ...groupConversationEntity,
        teamId: null
      })
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([adminMember])

      await expect(conversationService.deleteConversation(CONVERSATION_ID)).rejects.toThrow(
        'Conversation teamId must not be null.'
      )

      expect(mockTeamsApiClient.deleteConversation).not.toHaveBeenCalled()
    })

    it('should throw when app user is not an admin', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(groupConversationEntity)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([
        {
          ...adminMember,
          role: ConversationRole.MEMBER
        }
      ])

      await expect(conversationService.deleteConversation(CONVERSATION_ID)).rejects.toThrow()

      expect(mockTeamsApiClient.deleteConversation).not.toHaveBeenCalled()
    })

    it('should throw when app user domain does not match even if user_id is correct', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(groupConversationEntity)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([
        {
          ...adminMember,
          userId: SELF_USER_ID.id,
          userDomain: 'different-domain'
        }
      ])

      await expect(conversationService.deleteConversation(CONVERSATION_ID)).rejects.toThrow(
        'App user is not an admin in the conversation.'
      )
      expect(mockTeamsApiClient.deleteConversation).not.toHaveBeenCalled()
    })

    it('should throw when app user is not in the conversation', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(groupConversationEntity)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([
        {
          ...adminMember,
          userId: USER_ID.id
        }
      ])

      await expect(conversationService.deleteConversation(CONVERSATION_ID)).rejects.toThrow()

      expect(mockTeamsApiClient.deleteConversation).not.toHaveBeenCalled()
    })

    it('should not delete local data when API call fails', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(groupConversationEntity)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([adminMember])
      vi.mocked(mockTeamsApiClient.deleteConversation).mockRejectedValue(new Error('delete failed'))
      const wipeSpy = vi
        .spyOn(conversationService as any, 'deleteAllConversationDataFromLocalStorages')
        .mockResolvedValue(undefined)

      await expect(conversationService.deleteConversation(CONVERSATION_ID)).rejects.toThrow('delete failed')

      expect(wipeSpy).not.toHaveBeenCalled()

      wipeSpy.mockRestore()
    })
  })

  describe('addMembersToConversation', () => {
    const groupConversationEntity: ConversationEntity = {
      id: CONVERSATION_ID.id,
      domain: CONVERSATION_ID.domain,
      name: 'Group Conversation',
      teamId: TEAM_ID,
      mlsGroupId: MLS_GROUP_ID,
      creationDate: null,
      type: ConversationType.GROUP
    }

    const adminMember = {
      userId: SELF_USER_ID.id,
      userDomain: SELF_USER_ID.domain,
      conversationId: CONVERSATION_ID.id,
      conversationDomain: CONVERSATION_ID.domain,
      role: ConversationRole.ADMIN,
      creationDate: null
    }

    beforeEach(() => {
      ;(mockCoreCryptoService as any).addClientsToMlsConversation = vi.fn()
    })

    it('should throw when members list is empty', async () => {
      await expect(conversationService.addMembersToConversation(CONVERSATION_ID, [])).rejects.toThrow(
        'List of members cannot be empty.'
      )

      expect((mockCoreCryptoService as any).addClientsToMlsConversation).not.toHaveBeenCalled()
    })

    it('should throw when conversation is not a GROUP', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue({
        ...groupConversationEntity,
        type: ConversationType.ONE_TO_ONE
      })
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([adminMember])

      await expect(conversationService.addMembersToConversation(CONVERSATION_ID, [USER_ID])).rejects.toThrow(
        'Conversation type is not GROUP.'
      )

      expect((mockCoreCryptoService as any).addClientsToMlsConversation).not.toHaveBeenCalled()
    })

    it('should throw when app user is not an admin', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(groupConversationEntity)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([
        {
          ...adminMember,
          role: ConversationRole.MEMBER
        }
      ])

      await expect(conversationService.addMembersToConversation(CONVERSATION_ID, [USER_ID])).rejects.toThrow(
        'App user is not an admin in the conversation.'
      )

      expect((mockCoreCryptoService as any).addClientsToMlsConversation).not.toHaveBeenCalled()
    })

    it('should call coreCryptoService with mls_group_id and members', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(groupConversationEntity)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([adminMember])
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockResolvedValue({
        membersAdded: [USER_ID],
        membersFailedToAdd: []
      })

      await conversationService.addMembersToConversation(CONVERSATION_ID, [USER_ID])

      expect((mockCoreCryptoService as any).addClientsToMlsConversation).toHaveBeenCalledWith(MLS_GROUP_ID, [USER_ID])
    })

    it('should save only successUsers to the repository', async () => {
      const anotherUserId: QualifiedId = {id: 'another-user-id', domain: 'wire.com'}

      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(groupConversationEntity)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([adminMember])
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockResolvedValue({
        membersAdded: [USER_ID],
        membersFailedToAdd: [anotherUserId]
      })

      await conversationService.addMembersToConversation(CONVERSATION_ID, [USER_ID, anotherUserId])

      expect(mockConversationMemberRepository.saveMany).toHaveBeenCalledWith([
        {
          userId: USER_ID.id,
          userDomain: USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: ConversationRole.MEMBER,
          creationDate: null
        }
      ])
    })

    it('should return successUsers and failedUsers from coreCryptoService', async () => {
      const anotherUserId: QualifiedId = {id: 'another-user-id', domain: 'wire.com'}

      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(groupConversationEntity)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([adminMember])
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockResolvedValue({
        membersAdded: [USER_ID],
        membersFailedToAdd: [anotherUserId]
      })

      const result = await conversationService.addMembersToConversation(CONVERSATION_ID, [USER_ID, anotherUserId])

      expect(result.membersAdded).toEqual([USER_ID])
      expect(result.membersFailedToAdd).toEqual([anotherUserId])
    })

    it('should throw and not save members when coreCryptoService fails', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(groupConversationEntity)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([adminMember])
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockRejectedValue(new Error('MLS error'))

      await expect(conversationService.addMembersToConversation(CONVERSATION_ID, [USER_ID])).rejects.toThrow(
        'Unable to add members to MLS conversation'
      )

      expect(mockConversationMemberRepository.saveMany).not.toHaveBeenCalled()
    })
  })

  describe('updateConversationMemberRole', () => {
    const groupConversationEntity: ConversationEntity = {
      id: CONVERSATION_ID.id,
      domain: CONVERSATION_ID.domain,
      name: 'Group Conversation',
      teamId: TEAM_ID,
      mlsGroupId: MLS_GROUP_ID,
      creationDate: null,
      type: ConversationType.GROUP
    }

    const adminMember = {
      userId: SELF_USER_ID.id,
      userDomain: SELF_USER_ID.domain,
      conversationId: CONVERSATION_ID.id,
      conversationDomain: CONVERSATION_ID.domain,
      role: ConversationRole.ADMIN,
      creationDate: null
    }

    beforeEach(() => {
      ;(mockConversationsApiClient as any).updateConversationMemberRole = vi.fn()
      ;(mockConversationMemberRepository as any).save = vi.fn()
    })

    it('should call API and save member when all conditions are met', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(groupConversationEntity)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([adminMember])
      vi.mocked((mockConversationMemberRepository as any).exists).mockReturnValue(true)
      vi.mocked((mockConversationsApiClient as any).updateConversationMemberRole).mockResolvedValue(undefined)

      await conversationService.updateConversationMemberRole(CONVERSATION_ID, USER_ID, ConversationRole.MEMBER)

      expect((mockConversationsApiClient as any).updateConversationMemberRole).toHaveBeenCalledWith(
        CONVERSATION_ID,
        USER_ID,
        ConversationRole.MEMBER
      )
      expect((mockConversationMemberRepository as any).save).toHaveBeenCalledWith({
        userId: USER_ID.id,
        userDomain: USER_ID.domain,
        conversationId: CONVERSATION_ID.id,
        conversationDomain: CONVERSATION_ID.domain,
        role: ConversationRole.MEMBER,
        creationDate: null
      })
    })

    it('should throw when user is not in the conversation', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(groupConversationEntity)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([adminMember])
      vi.mocked((mockConversationMemberRepository as any).exists).mockReturnValue(false)

      await expect(
        conversationService.updateConversationMemberRole(CONVERSATION_ID, USER_ID, ConversationRole.MEMBER)
      ).rejects.toThrow('App user is not in the conversation.')

      expect((mockConversationsApiClient as any).updateConversationMemberRole).not.toHaveBeenCalled()
      expect((mockConversationMemberRepository as any).save).not.toHaveBeenCalled()
    })

    it('should throw when conversation is not a GROUP', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue({
        ...groupConversationEntity,
        type: ConversationType.ONE_TO_ONE
      })
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([adminMember])

      await expect(
        conversationService.updateConversationMemberRole(CONVERSATION_ID, USER_ID, ConversationRole.MEMBER)
      ).rejects.toThrow('Conversation type is not GROUP.')

      expect((mockConversationsApiClient as any).updateConversationMemberRole).not.toHaveBeenCalled()
      expect((mockConversationMemberRepository as any).save).not.toHaveBeenCalled()
    })

    it('should throw when app user is not an admin', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(groupConversationEntity)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([
        {
          ...adminMember,
          role: ConversationRole.MEMBER
        }
      ])

      await expect(
        conversationService.updateConversationMemberRole(CONVERSATION_ID, USER_ID, ConversationRole.ADMIN)
      ).rejects.toThrow('App user is not an admin in the conversation.')

      expect((mockConversationsApiClient as any).updateConversationMemberRole).not.toHaveBeenCalled()
      expect((mockConversationMemberRepository as any).save).not.toHaveBeenCalled()
    })

    it('should not save member when API call fails', async () => {
      vi.mocked(mockConversationRepository.findByIdAndDomain).mockReturnValue(groupConversationEntity)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue([adminMember])
      vi.mocked((mockConversationMemberRepository as any).exists).mockReturnValue(true)
      vi.mocked((mockConversationsApiClient as any).updateConversationMemberRole).mockRejectedValue(
        new Error('update failed')
      )

      await expect(
        conversationService.updateConversationMemberRole(CONVERSATION_ID, USER_ID, ConversationRole.MEMBER)
      ).rejects.toThrow('update failed')

      expect((mockConversationMemberRepository as any).save).not.toHaveBeenCalled()
    })
  })

  describe('getConversations', () => {
    it('should return all conversations excluding SELF type', async () => {
      const conversations: ConversationEntity[] = [
        {
          id: 'conv-1',
          domain: 'wire.com',
          name: 'Group Conversation',
          teamId: TEAM_ID,
          mlsGroupId: 'mls-1',
          creationDate: null,
          type: ConversationType.GROUP
        },
        {
          id: 'conv-2',
          domain: 'wire.com',
          name: 'Self Conversation',
          teamId: TEAM_ID,
          mlsGroupId: 'mls-2',
          creationDate: null,
          type: ConversationType.SELF
        },
        {
          id: 'conv-3',
          domain: 'wire.com',
          name: 'One To One Conversation',
          teamId: TEAM_ID,
          mlsGroupId: 'mls-3',
          creationDate: null,
          type: ConversationType.ONE_TO_ONE
        }
      ]

      vi.mocked(mockConversationRepository.getAll).mockReturnValue(conversations)

      const result = await conversationService.getAllConversations()

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'conv-1',
        domain: 'wire.com',
        name: 'Group Conversation',
        type: ConversationType.GROUP,
        teamId: TEAM_ID
      })
      expect(result[1]).toEqual({
        id: 'conv-3',
        domain: 'wire.com',
        name: 'One To One Conversation',
        type: ConversationType.ONE_TO_ONE,
        teamId: TEAM_ID
      })
    })

    it('should return empty list when all conversations are of SELF type', async () => {
      vi.mocked(mockConversationRepository.getAll).mockReturnValue([
        {
          id: 'conv-1',
          domain: 'wire.com',
          name: 'Self Conversation',
          teamId: TEAM_ID,
          mlsGroupId: 'mls-1',
          creationDate: null,
          type: ConversationType.SELF
        }
      ])

      const result = await conversationService.getAllConversations()

      expect(result).toHaveLength(0)
    })

    it('should return empty list when there are no conversations', async () => {
      vi.mocked(mockConversationRepository.getAll).mockReturnValue([])

      const result = await conversationService.getAllConversations()

      expect(result).toHaveLength(0)
    })
  })

  describe('removeMembersFromConversation', () => {
    const MEMBERS: QualifiedId[] = [
      {id: 'user-1', domain: 'wire.com'},
      {id: 'user-2', domain: 'wire.com'}
    ]

    const CONVERSATION = {
      id: CONVERSATION_ID.id,
      domain: CONVERSATION_ID.domain,
      name: 'Group Conversation',
      teamId: TEAM_ID,
      mlsGroupId: MLS_GROUP_ID,
      creationDate: null,
      type: ConversationType.GROUP
    }

    beforeEach(() => {
      vi.clearAllMocks()

      // Mock getConversationById
      vi.spyOn(conversationService as any, 'getConversationById').mockResolvedValue(CONVERSATION)

      // Mock filterMembersInConversation to return all members (valid scenario)
      vi.spyOn(conversationService as any, 'filterMembersInConversation').mockReturnValue(MEMBERS)

      // Create mock CryptoClientId objects
      const mockClientId1 = CryptoClientId.create('user-1', 'device-1', 'wire.com')
      const mockClientId2 = CryptoClientId.create('user-2', 'device-1', 'wire.com')

      // Mock userService.getUsersClientIds to return Map<string, CryptoClientId[]>
      vi.mocked(mockUserService.getUsersClientIds).mockResolvedValue(
        new Map([
          [QualifiedId.toKey(MEMBERS[0]!), [mockClientId1]],
          [QualifiedId.toKey(MEMBERS[1]!), [mockClientId2]]
        ])
      )

      // Mock coreCryptoService
      vi.mocked(mockCoreCryptoService.removeClientsFromMlsConversation).mockResolvedValue(undefined)

      // Mock conversationMemberRepository
      vi.mocked(mockConversationMemberRepository.exists).mockReturnValue(true)

      // Mock permission checks
      vi.spyOn(conversationService as any, 'requireConversationIsGroupOrChannel').mockImplementation(() => {})

      vi.spyOn(conversationService as any, 'requireAppIsAdminInConversation').mockImplementation(() => {})
    })

    it('should throw when members list is empty', async () => {
      await expect(conversationService.removeMembersFromConversation(CONVERSATION_ID, [])).rejects.toThrow(
        'List of members cannot be empty.'
      )
    })

    it('should return result with membersRemoved', async () => {
      const result = await conversationService.removeMembersFromConversation(CONVERSATION_ID, MEMBERS)

      expect(result).toHaveProperty('membersRemoved')
      expect(result.membersRemoved).toEqual(MEMBERS)
    })

    it('should remove members successfully from MLS conversation', async () => {
      const mockClientId1 = CryptoClientId.create('user-1', 'device-1', 'wire.com')
      const mockClientId2 = CryptoClientId.create('user-2', 'device-1', 'wire.com')

      await conversationService.removeMembersFromConversation(CONVERSATION_ID, MEMBERS)

      expect(conversationService['getConversationById']).toHaveBeenCalledWith(CONVERSATION_ID)

      expect(mockUserService.getUsersClientIds).toHaveBeenCalledWith(MEMBERS)

      expect(mockCoreCryptoService.removeClientsFromMlsConversation).toHaveBeenCalledWith(
        MLS_GROUP_ID,
        expect.arrayContaining([mockClientId1, mockClientId2])
      )

      expect(mockConversationMemberRepository.deleteMany).toHaveBeenCalledWith(
        MEMBERS,
        CONVERSATION_ID.id,
        CONVERSATION_ID.domain
      )
    })

    it('should return empty result when members are not in conversation', async () => {
      // Mock filterMembersInConversation to return empty array (no valid members)
      vi.spyOn(conversationService as any, 'filterMembersInConversation').mockReturnValue([])

      const result = await conversationService.removeMembersFromConversation(CONVERSATION_ID, MEMBERS)

      expect(result.membersRemoved).toEqual([])
      expect(mockCoreCryptoService.removeClientsFromMlsConversation).not.toHaveBeenCalled()
      expect(mockConversationMemberRepository.deleteMany).not.toHaveBeenCalled()
    })

    it('should return empty result when members have no clients', async () => {
      // Mock getUsersClientIds to return empty map (users have no clients)
      vi.mocked(mockUserService.getUsersClientIds).mockResolvedValue(new Map())

      const result = await conversationService.removeMembersFromConversation(CONVERSATION_ID, MEMBERS)

      expect(result.membersRemoved).toEqual([])
      expect(mockCoreCryptoService.removeClientsFromMlsConversation).not.toHaveBeenCalled()
      expect(mockConversationMemberRepository.deleteMany).not.toHaveBeenCalled()
    })

    it('should handle partial success when some users have no clients', async () => {
      const mockClientId1 = CryptoClientId.create('user-1', 'device-1', 'wire.com')

      // Only first user has clients (second user not in map since they have no clients)
      vi.mocked(mockUserService.getUsersClientIds).mockResolvedValue(
        new Map([[QualifiedId.toKey(MEMBERS[0]!), [mockClientId1]]])
      )

      const result = await conversationService.removeMembersFromConversation(CONVERSATION_ID, MEMBERS)

      expect(result.membersRemoved).toEqual([MEMBERS[0]])
      expect(mockCoreCryptoService.removeClientsFromMlsConversation).toHaveBeenCalledWith(MLS_GROUP_ID, [mockClientId1])
      expect(mockConversationMemberRepository.deleteMany).toHaveBeenCalledWith(
        [MEMBERS[0]],
        CONVERSATION_ID.id,
        CONVERSATION_ID.domain
      )
    })

    it('should handle MLS removal failure and return empty result', async () => {
      vi.mocked(mockCoreCryptoService.removeClientsFromMlsConversation).mockRejectedValue(
        new Error('MLS removal failed')
      )

      const result = await conversationService.removeMembersFromConversation(CONVERSATION_ID, MEMBERS)

      expect(result.membersRemoved).toEqual([])
      expect(mockConversationMemberRepository.deleteMany).not.toHaveBeenCalled()
    })
  })

  describe('createOneToOne', () => {
    const OTHER_USER_ID: QualifiedId = {id: 'other-user-id', domain: 'wire.com'}

    const buildOneToOneResponse = (): OneToOneConversationResponse =>
      ({
        conversation: {
          qualified_id: CONVERSATION_ID,
          type: ConversationType.ONE_TO_ONE,
          name: null,
          team: TEAM_ID,
          group_id: MLS_GROUP_ID,
          epoch: 0,
          protocol: CryptoProtocol.MLS,
          members: {
            others: [],
            self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
          }
        } as ConversationResponse,
        public_keys: {} as any
      }) as any

    it('should return existing conversation when it exists in DB and MLS group exists', async () => {
      const existingEntity: ConversationEntity = {
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: `${OTHER_USER_ID.id}@${OTHER_USER_ID.domain}`,
        teamId: TEAM_ID,
        mlsGroupId: MLS_GROUP_ID,
        creationDate: null,
        type: ConversationType.ONE_TO_ONE
      }

      vi.mocked((mockConversationRepository as any).findOneToOneByNameAndDomain).mockReturnValue(existingEntity)
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)

      const result = await conversationService.createOneToOne(OTHER_USER_ID)

      expect((mockConversationRepository as any).findOneToOneByNameAndDomain).toHaveBeenCalledWith(
        `${OTHER_USER_ID.id}@${OTHER_USER_ID.domain}`,
        OTHER_USER_ID.domain
      )
      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect((mockOneToOneConversationsApiClient as any).getOneToOneConversation).not.toHaveBeenCalled()
      expect(result).toEqual(new QualifiedId(existingEntity.id, existingEntity.domain))
    })

    it('should create a new conversation when DB record exists but MLS group does not', async () => {
      const staleEntity: ConversationEntity = {
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: `${OTHER_USER_ID.id}@${OTHER_USER_ID.domain}`,
        teamId: TEAM_ID,
        mlsGroupId: MLS_GROUP_ID,
        creationDate: null,
        type: ConversationType.ONE_TO_ONE
      }

      vi.mocked((mockConversationRepository as any).findOneToOneByNameAndDomain).mockReturnValue(staleEntity)
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)

      const response = buildOneToOneResponse()
      vi.mocked((mockOneToOneConversationsApiClient as any).getOneToOneConversation).mockResolvedValue(response)
      vi.mocked(mockCoreCryptoService.establishMlsConversation).mockResolvedValue(undefined)
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockResolvedValue({
        membersAdded: [OTHER_USER_ID],
        membersFailedToAdd: []
      })

      const result = await conversationService.createOneToOne(OTHER_USER_ID)

      expect((mockOneToOneConversationsApiClient as any).getOneToOneConversation).toHaveBeenCalledWith(OTHER_USER_ID)
      expect(mockCoreCryptoService.establishMlsConversation).toHaveBeenCalledWith(MLS_GROUP_ID, response.public_keys)
      expect((mockCoreCryptoService as any).addClientsToMlsConversation).toHaveBeenCalledWith(MLS_GROUP_ID, [
        OTHER_USER_ID
      ])
      expect(mockConversationRepository.save).toHaveBeenCalled()
      expect(result).toEqual(new QualifiedId(CONVERSATION_ID.id, CONVERSATION_ID.domain))
    })

    it('should create a new conversation when no DB record exists', async () => {
      vi.mocked((mockConversationRepository as any).findOneToOneByNameAndDomain).mockReturnValue(null)

      const response = buildOneToOneResponse()
      vi.mocked((mockOneToOneConversationsApiClient as any).getOneToOneConversation).mockResolvedValue(response)
      vi.mocked(mockCoreCryptoService.establishMlsConversation).mockResolvedValue(undefined)
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockResolvedValue({
        membersAdded: [OTHER_USER_ID],
        membersFailedToAdd: []
      })

      const result = await conversationService.createOneToOne(OTHER_USER_ID)

      expect(mockCoreCryptoService.conversationExists).not.toHaveBeenCalled()
      expect(result).toEqual(new QualifiedId(CONVERSATION_ID.id, CONVERSATION_ID.domain))
      expect(mockConversationMemberRepository.saveMany).toHaveBeenCalledWith([
        {
          userId: SELF_USER_ID.id,
          userDomain: SELF_USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: 'wire_admin',
          creationDate: null
        },
        {
          userId: OTHER_USER_ID.id,
          userDomain: OTHER_USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: ConversationRole.MEMBER,
          creationDate: null
        }
      ])
    })

    it('should only persist members successfully claimed by CoreCrypto', async () => {
      vi.mocked((mockConversationRepository as any).findOneToOneByNameAndDomain).mockReturnValue(null)

      const response = buildOneToOneResponse()
      vi.mocked((mockOneToOneConversationsApiClient as any).getOneToOneConversation).mockResolvedValue(response)
      vi.mocked(mockCoreCryptoService.establishMlsConversation).mockResolvedValue(undefined)
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockResolvedValue({
        membersAdded: [],
        membersFailedToAdd: [OTHER_USER_ID]
      })

      await conversationService.createOneToOne(OTHER_USER_ID)

      expect(mockConversationMemberRepository.saveMany).toHaveBeenCalledWith([
        {
          userId: SELF_USER_ID.id,
          userDomain: SELF_USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: 'wire_admin',
          creationDate: null
        }
      ])
    })

    it('should propagate error and skip local persistence when API call fails', async () => {
      vi.mocked((mockConversationRepository as any).findOneToOneByNameAndDomain).mockReturnValue(null)
      vi.mocked((mockOneToOneConversationsApiClient as any).getOneToOneConversation).mockRejectedValue(
        new Error('network error')
      )

      await expect(conversationService.createOneToOne(OTHER_USER_ID)).rejects.toThrow('network error')

      expect(mockCoreCryptoService.establishMlsConversation).not.toHaveBeenCalled()
      expect(mockConversationRepository.save).not.toHaveBeenCalled()
    })
  })

  describe('createGroup', () => {
    const GROUP_NAME = 'Test Group'

    beforeEach(() => {
      ;(mockUserService as any).getUser = vi.fn()
      ;(mockConversationsApiClient as any).createGroupConversation = vi.fn()
      ;(mockCoreCryptoService as any).establishMlsConversation = vi.fn()
      ;(mockCoreCryptoService as any).addClientsToMlsConversation = vi.fn()
    })

    it('should create group conversation, establish MLS group, and save conversation with members', async () => {
      vi.mocked((mockUserService as any).getUser).mockResolvedValue({teamId: new TeamId(TEAM_ID)} as any)

      const conversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.GROUP,
        name: GROUP_NAME,
        team: TEAM_ID,
        group_id: MLS_GROUP_ID,
        epoch: 0,
        protocol: CryptoProtocol.MLS,
        members: {
          others: [],
          self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
        }
      } as ConversationResponse

      vi.mocked((mockConversationsApiClient as any).createGroupConversation).mockResolvedValue(conversationResponse)
      vi.mocked((mockCoreCryptoService as any).establishMlsConversation).mockResolvedValue(undefined)
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockResolvedValue({
        membersAdded: [USER_ID],
        membersFailedToAdd: []
      })

      const result = await conversationService.createGroup(GROUP_NAME, [USER_ID])

      expect((mockUserService as any).getUser).toHaveBeenCalledWith(
        new QualifiedId(SELF_USER_ID.id, SELF_USER_ID.domain)
      )
      expect((mockConversationsApiClient as any).createGroupConversation).toHaveBeenCalled()
      expect((mockCoreCryptoService as any).establishMlsConversation).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect((mockCoreCryptoService as any).addClientsToMlsConversation).toHaveBeenCalledWith(MLS_GROUP_ID, [USER_ID])

      expect(mockConversationRepository.save).toHaveBeenCalledWith({
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: GROUP_NAME,
        teamId: TEAM_ID,
        mlsGroupId: MLS_GROUP_ID,
        creationDate: null,
        type: ConversationType.GROUP
      })

      expect(mockConversationMemberRepository.saveMany).toHaveBeenCalledWith([
        {
          userId: SELF_USER_ID.id,
          userDomain: SELF_USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: 'wire_admin',
          creationDate: null
        },
        {
          userId: USER_ID.id,
          userDomain: USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: ConversationRole.MEMBER,
          creationDate: null
        }
      ])

      expect(result).toEqual(CONVERSATION_ID)
    })

    it('should throw when app user does not belong to a team', async () => {
      vi.mocked((mockUserService as any).getUser).mockResolvedValue({teamId: null} as any)

      await expect(conversationService.createGroup(GROUP_NAME, [USER_ID])).rejects.toThrow(
        'App user does not belong to a team.'
      )

      expect((mockConversationsApiClient as any).createGroupConversation).not.toHaveBeenCalled()
      expect((mockCoreCryptoService as any).establishMlsConversation).not.toHaveBeenCalled()
    })

    it('should only save members successfully claimed by CoreCrypto, not all usersToAdd', async () => {
      vi.mocked((mockUserService as any).getUser).mockResolvedValue({teamId: new TeamId(TEAM_ID)} as any)

      const anotherUserId: QualifiedId = {id: 'another-user-id', domain: 'wire.com'}

      const conversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.GROUP,
        name: GROUP_NAME,
        team: TEAM_ID,
        group_id: MLS_GROUP_ID,
        epoch: 0,
        protocol: CryptoProtocol.MLS,
        members: {
          others: [],
          self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
        }
      } as ConversationResponse

      vi.mocked((mockConversationsApiClient as any).createGroupConversation).mockResolvedValue(conversationResponse)
      vi.mocked((mockCoreCryptoService as any).establishMlsConversation).mockResolvedValue(undefined)
      // Only USER_ID was successfully claimed by CoreCrypto; anotherUserId failed
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockResolvedValue({
        membersAdded: [USER_ID],
        membersFailedToAdd: [anotherUserId]
      })

      await conversationService.createGroup(GROUP_NAME, [USER_ID, anotherUserId])

      expect((mockCoreCryptoService as any).addClientsToMlsConversation).toHaveBeenCalledWith(MLS_GROUP_ID, [
        USER_ID,
        anotherUserId
      ])

      expect(mockConversationMemberRepository.saveMany).toHaveBeenCalledWith([
        {
          userId: SELF_USER_ID.id,
          userDomain: SELF_USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: 'wire_admin',
          creationDate: null
        },
        {
          userId: USER_ID.id,
          userDomain: USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: ConversationRole.MEMBER,
          creationDate: null
        }
      ])
    })
  })

  describe('createChannel', () => {
    const CHANNEL_NAME = 'Test Channel'

    beforeEach(() => {
      ;(mockUserService as any).getUser = vi.fn()
      ;(mockConversationsApiClient as any).createGroupConversation = vi.fn()
      ;(mockCoreCryptoService as any).establishMlsConversation = vi.fn()
      ;(mockCoreCryptoService as any).addClientsToMlsConversation = vi.fn()
    })

    it('should create channel conversation, establish MLS group, and save conversation with members', async () => {
      vi.mocked((mockUserService as any).getUser).mockResolvedValue({teamId: new TeamId(TEAM_ID)} as any)

      const conversationResponse: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.GROUP,
        name: CHANNEL_NAME,
        team: TEAM_ID,
        group_id: MLS_GROUP_ID,
        epoch: 0,
        protocol: CryptoProtocol.MLS,
        members: {
          others: [],
          self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
        }
      } as ConversationResponse

      vi.mocked((mockConversationsApiClient as any).createGroupConversation).mockResolvedValue(conversationResponse)
      vi.mocked((mockCoreCryptoService as any).establishMlsConversation).mockResolvedValue(undefined)
      vi.mocked((mockCoreCryptoService as any).addClientsToMlsConversation).mockResolvedValue({
        membersAdded: [USER_ID],
        membersFailedToAdd: []
      })

      const result = await conversationService.createChannel(CHANNEL_NAME, [USER_ID])

      expect((mockUserService as any).getUser).toHaveBeenCalledWith(
        new QualifiedId(SELF_USER_ID.id, SELF_USER_ID.domain)
      )
      expect((mockConversationsApiClient as any).createGroupConversation).toHaveBeenCalled()
      expect((mockCoreCryptoService as any).establishMlsConversation).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect((mockCoreCryptoService as any).addClientsToMlsConversation).toHaveBeenCalledWith(MLS_GROUP_ID, [USER_ID])

      expect(mockConversationRepository.save).toHaveBeenCalledWith({
        id: CONVERSATION_ID.id,
        domain: CONVERSATION_ID.domain,
        name: CHANNEL_NAME,
        teamId: TEAM_ID,
        mlsGroupId: MLS_GROUP_ID,
        creationDate: null,
        type: ConversationType.GROUP
      })

      expect(mockConversationMemberRepository.saveMany).toHaveBeenCalledWith([
        {
          userId: SELF_USER_ID.id,
          userDomain: SELF_USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: 'wire_admin',
          creationDate: null
        },
        {
          userId: USER_ID.id,
          userDomain: USER_ID.domain,
          conversationId: CONVERSATION_ID.id,
          conversationDomain: CONVERSATION_ID.domain,
          role: ConversationRole.MEMBER,
          creationDate: null
        }
      ])

      expect(result).toEqual(CONVERSATION_ID)
    })

    it('should throw when app user does not belong to a team', async () => {
      vi.mocked((mockUserService as any).getUser).mockResolvedValue({teamId: null} as any)

      await expect(conversationService.createChannel(CHANNEL_NAME, [USER_ID])).rejects.toThrow(
        'App user does not belong to a team.'
      )

      expect((mockConversationsApiClient as any).createGroupConversation).not.toHaveBeenCalled()
      expect((mockCoreCryptoService as any).establishMlsConversation).not.toHaveBeenCalled()
    })
  })

  const TEAM_ID: string = 'team-id'
  const SELF_USER_ID: QualifiedId = {
    id: 'self-user-id',
    domain: 'wire.com'
  }
  const USER_ID: QualifiedId = {
    id: 'user-id',
    domain: 'wire.com'
  }
  const CONVERSATION_ID: QualifiedId = {
    id: 'conversation-id',
    domain: 'wire.com'
  }
  const MLS_GROUP_ID: string = 'mls-group-id-1234'
})
