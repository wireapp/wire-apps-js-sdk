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
import {UsersApiClient} from '../../src/api/UsersApiClient.js'
import {ConversationsApiClient} from '../../src/api/ConversationsApiClient.js'
import {ConversationRepository} from '../../src/db/ConversationRepository.js'
import {ConversationMemberRepository} from '../../src/db/ConversationMemberRepository.js'
import {ConversationType} from '../../src/model/conversation/ConversationType.js'
import type {QualifiedId} from '../../src/model/QualifiedId.js'
import type {ConversationResponse} from '../../src/api/response/ConversationResponse.js'
import type {ConversationEntity} from '../../src/db/model/ConversationEntity.js'
import {container} from 'tsyringe'
import {AppProperties} from '../../src/service/AppProperties.js'
import {CoreCryptoService} from '../../src/core/CoreCryptoService.js'
import {CryptoProtocol} from '../../src/model/CryptoProtocol.js'

describe('ConversationService', () => {
  let conversationService: ConversationService
  let mockUsersApiClient: UsersApiClient
  let mockConversationsApiClient: ConversationsApiClient
  let mockConversationRepository: ConversationRepository
  let mockConversationMemberRepository: ConversationMemberRepository
  let mockAppProperties: AppProperties
  let mockCoreCryptoService: CoreCryptoService

  beforeEach(() => {
    container.clearInstances()

    mockUsersApiClient = {
      getUserName: vi.fn()
    } as any

    mockConversationsApiClient = {
      getConversation: vi.fn(),
      getConversationGroupInfo: vi.fn(),
      getAllConversationIds: vi.fn(),
      getConversationsById: vi.fn()
    } as any

    mockConversationRepository = {
      save: vi.fn(),
      findByIdAndDomain: vi.fn(),
      delete: vi.fn()
    } as any

    mockConversationMemberRepository = {
      saveMany: vi.fn(),
      getMembersByConversationId: vi.fn(),
      deleteAllMembersInConversation: vi.fn(),
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
      mockUsersApiClient,
      mockConversationsApiClient,
      mockConversationRepository,
      mockConversationMemberRepository,
      mockAppProperties,
      mockCoreCryptoService
    )

    // TODO: Can remove/replace this once we have implemented a proper logger lib
    // Suppress console.info for cleaner test output
    vi.spyOn(console, 'info').mockImplementation(() => {
    })
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

      expect(mockConversationRepository.findByIdAndDomain).toHaveBeenCalledWith(CONVERSATION_ID.id, CONVERSATION_ID.domain)
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

      expect(mockConversationRepository.findByIdAndDomain).toHaveBeenCalledWith(CONVERSATION_ID.id, CONVERSATION_ID.domain)
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

  describe('getMembersByConversationId', () => {
    it('returns members from repository', () => {
      const members = [
        {
          user_id: 'a',
          user_domain: 'wire.com',
          conversation_id: 'c',
          conversation_domain: 'wire.com',
          role: 'wire_member',
          creation_date: null
        }
      ]

      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue(members)

      const result = conversationService.getMembersByConversationId(CONVERSATION_ID)

      expect(mockConversationMemberRepository.getMembersByConversationId).toHaveBeenCalledWith(CONVERSATION_ID.id, CONVERSATION_ID.domain)
      expect(result).toEqual(members)
    })
  })

  describe('deleteAllConversationDataFromLocalStorages', () => {
    it('wipes crypto when exists then deletes members and conversation', async () => {
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
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)
      vi.mocked(mockCoreCryptoService.wipeConversation).mockResolvedValue(undefined)

      await conversationService.deleteAllConversationDataFromLocalStorages(CONVERSATION_ID)

      expect(mockConversationRepository.findByIdAndDomain).toHaveBeenCalledWith(CONVERSATION_ID.id, CONVERSATION_ID.domain)
      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockCoreCryptoService.wipeConversation).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationMemberRepository.deleteAllMembersInConversation).toHaveBeenCalledWith(CONVERSATION_ID.id, CONVERSATION_ID.domain)
      expect(mockConversationRepository.delete).toHaveBeenCalledWith(CONVERSATION_ID.id, CONVERSATION_ID.domain)
    })

    it('skips crypto wipe when conversation does not exist and still deletes DB data', async () => {
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
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)

      await conversationService.deleteAllConversationDataFromLocalStorages(CONVERSATION_ID)

      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockCoreCryptoService.wipeConversation).not.toHaveBeenCalled()
      expect(mockConversationMemberRepository.deleteAllMembersInConversation).toHaveBeenCalledWith(CONVERSATION_ID.id, CONVERSATION_ID.domain)
      expect(mockConversationRepository.delete).toHaveBeenCalledWith(CONVERSATION_ID.id, CONVERSATION_ID.domain)
    })

    it('propagates error when wipeConversation fails and does not perform DB deletes', async () => {
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
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(true)
      vi.mocked(mockCoreCryptoService.wipeConversation).mockRejectedValue(new Error('wipe failed'))

      await expect(conversationService.deleteAllConversationDataFromLocalStorages(CONVERSATION_ID)).rejects.toThrow('wipe failed')

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
        team_id: TEAM_ID,
        mls_group_id: MLS_GROUP_ID,
        creation_date: null,
        type: ConversationType.GROUP
      } as any)

      const members = [
        {userId: USER_ID, role: 'wire_member'},
        {userId: SELF_USER_ID, role: 'wire_admin'}
      ] as any

      await conversationService.addMembers(members, CONVERSATION_ID)

      expect(mockConversationMemberRepository.saveMany).toHaveBeenCalledWith([
        {
          user_id: USER_ID.id,
          user_domain: USER_ID.domain,
          conversation_id: CONVERSATION_ID.id,
          conversation_domain: CONVERSATION_ID.domain,
          role: 'wire_member',
          creation_date: null
        },
        {
          user_id: SELF_USER_ID.id,
          user_domain: SELF_USER_ID.domain,
          conversation_id: CONVERSATION_ID.id,
          conversation_domain: CONVERSATION_ID.domain,
          role: 'wire_admin',
          creation_date: null
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
      expect(mockCoreCryptoService.establishMlsConversation).toHaveBeenCalledWith([], 'mls-group-2')
      expect(mockAppProperties.setShouldRejoinConversations).toHaveBeenCalledWith(false)
    })
  })
  
  describe('establishOrJoinMlsConversation', () => {
    it('should skip conversation when it already exists', async () => {
      const conversation: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.GROUP,
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
  
    it('should join conversation when epoch is non-zero', async () => {
      const conversation: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.GROUP,
        protocol: CryptoProtocol.MLS,
        group_id: MLS_GROUP_ID,
        epoch: 5,
        members: {
          others: [],
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
    })
  
    it('should establish SELF conversation when epoch is zero', async () => {
      const conversation: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.SELF,
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
      expect(mockCoreCryptoService.establishMlsConversation).toHaveBeenCalledWith([], MLS_GROUP_ID)
      expect(mockConversationsApiClient.getConversationGroupInfo).not.toHaveBeenCalled()
      expect(mockCoreCryptoService.joinMlsConversation).not.toHaveBeenCalled()
    })
  
    it('should establish ONE_TO_ONE conversation with members', async () => {
      const conversation: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.ONE_TO_ONE,
        protocol: CryptoProtocol.MLS,
        group_id: MLS_GROUP_ID,
        epoch: 0,
        members: {
          others: [{qualified_id: USER_ID, conversation_role: 'wire_member'}],
          self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
        }
      } as ConversationResponse
  
      const mockMembers = [
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
      ]
  
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)
      vi.mocked(mockConversationMemberRepository.getMembersByConversationId).mockReturnValue(mockMembers)
  
      await (conversationService as any).establishOrJoinMlsConversation(conversation)
  
      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledWith(MLS_GROUP_ID)
      expect(mockConversationMemberRepository.getMembersByConversationId).toHaveBeenCalledWith(
        CONVERSATION_ID.id,
        CONVERSATION_ID.domain
      )
      expect(mockCoreCryptoService.establishMlsConversation).toHaveBeenCalledWith(
        [SELF_USER_ID, USER_ID],
        MLS_GROUP_ID
      )
    })
  
    it('should join conversation when epoch is null but not zero', async () => {
      const conversation: ConversationResponse = {
        qualified_id: CONVERSATION_ID,
        type: ConversationType.GROUP,
        protocol: CryptoProtocol.MLS,
        group_id: MLS_GROUP_ID,
        epoch: null as any,
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
        return ids.map(id => ({
          qualified_id: id,
          type: ConversationType.GROUP,
          protocol: CryptoProtocol.MLS,
          group_id: `mls-${id.id}`,
          epoch: 5,
          members: {
            others: [],
            self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
          }
        } as ConversationResponse))
      })
      
      const mockGroupInfoBytes = new Uint8Array([1, 2, 3])
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)
      vi.mocked(mockConversationsApiClient.getConversationGroupInfo).mockResolvedValue(mockGroupInfoBytes)
      
      await conversationService.establishOrRejoinConversations()
      
      // Should be called 3 times: batches of 1000, 1000, and 500
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenCalledTimes(3)
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenNthCalledWith(1, conversationIds.slice(0, 1000))
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenNthCalledWith(2, conversationIds.slice(1000, 2000))
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenNthCalledWith(3, conversationIds.slice(2000, 2500))
      
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
        return ids.map((id, idx) => ({
          qualified_id: id,
          type: ConversationType.GROUP,
          protocol: idx % 2 === 0 ? CryptoProtocol.MLS : CryptoProtocol.PROTEUS,
          group_id: `mls-${id.id}`,
          epoch: 0,
          members: {
            others: [],
            self: {qualified_id: SELF_USER_ID, conversation_role: 'wire_admin'}
          }
        } as ConversationResponse))
      })
      
      vi.mocked(mockCoreCryptoService.conversationExists).mockResolvedValue(false)
      
      await conversationService.establishOrRejoinConversations()
      
      // Should be called 3 times with exactly 1000 conversations each
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenCalledTimes(3)
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenNthCalledWith(1, conversationIds.slice(0, 1000))
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenNthCalledWith(2, conversationIds.slice(1000, 2000))
      expect(mockConversationsApiClient.getConversationsById).toHaveBeenNthCalledWith(3, conversationIds.slice(2000, 3000))
      
      // Should only process 1500 MLS conversations (50% of 3000)
      expect(mockCoreCryptoService.conversationExists).toHaveBeenCalledTimes(1500)
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
