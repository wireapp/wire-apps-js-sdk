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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConversationsApiClient } from '../../src/api/ConversationsApiClient.js'
import type { QualifiedId } from '../../src/model/QualifiedId.js'
import { ConversationRole } from '../../src/model/conversation/ConversationRole.js'

const WIRE_USER_ID = 'self-user-id'
const WIRE_USER_DOMAIN = 'wire.com'

const CONVERSATION_ID: QualifiedId = { id: 'conv-1', domain: 'example.com' }
const USER_ID: QualifiedId = { id: 'user-1', domain: 'example.com' }

describe('ConversationsApiClient', () => {
  let mockHttpClient: any
  let client: ConversationsApiClient

  beforeEach(() => {
    mockHttpClient = {
      getRequest: vi.fn(),
      postRequest: vi.fn(),
      putRequest: vi.fn(),
      deleteRequest: vi.fn()
    }

    client = new ConversationsApiClient(WIRE_USER_ID, WIRE_USER_DOMAIN, mockHttpClient)

    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  describe('getConversation', () => {
    it('should call getRequest with the correct path', async () => {
      vi.mocked(mockHttpClient.getRequest).mockResolvedValue({})

      await client.getConversation(CONVERSATION_ID)

      expect(mockHttpClient.getRequest).toHaveBeenCalledWith(
        `conversations/${CONVERSATION_ID.domain}/${CONVERSATION_ID.id}`
      )
    })

    it('should propagate errors from getRequest', async () => {
      vi.mocked(mockHttpClient.getRequest).mockRejectedValue(new Error('network-failure'))

      await expect(client.getConversation(CONVERSATION_ID)).rejects.toThrow('network-failure')
    })
  })

  describe('getConversationGroupInfo', () => {
    it('should call getRequest with the correct path and MLS accept header', async () => {
      vi.mocked(mockHttpClient.getRequest).mockResolvedValue(new Uint8Array())

      await client.getConversationGroupInfo(CONVERSATION_ID)

      expect(mockHttpClient.getRequest).toHaveBeenCalledWith(
        `conversations/${CONVERSATION_ID.domain}/${CONVERSATION_ID.id}/groupinfo`,
        { headerAccept: 'message/mls' }
      )
    })

    it('should propagate errors from getRequest', async () => {
      vi.mocked(mockHttpClient.getRequest).mockRejectedValue(new Error('network-failure'))

      await expect(client.getConversationGroupInfo(CONVERSATION_ID)).rejects.toThrow('network-failure')
    })
  })

  describe('getConversationsById', () => {
    it('should return empty array without calling API when given empty list', async () => {
      const result = await client.getConversationsById([])

      expect(mockHttpClient.postRequest).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })

    it('should call postRequest with the correct path and body', async () => {
      vi.mocked(mockHttpClient.postRequest).mockResolvedValue({ found: [] })

      await client.getConversationsById([CONVERSATION_ID])

      expect(mockHttpClient.postRequest).toHaveBeenCalledWith(
        'conversations/list',
        { qualified_ids: [CONVERSATION_ID] }
      )
    })

    it('should return found conversations', async () => {
      const mockConversation = { qualified_id: CONVERSATION_ID }
      vi.mocked(mockHttpClient.postRequest).mockResolvedValue({ found: [mockConversation] })

      const result = await client.getConversationsById([CONVERSATION_ID])

      expect(result).toEqual([mockConversation])
    })

    it('should propagate errors from postRequest', async () => {
      vi.mocked(mockHttpClient.postRequest).mockRejectedValue(new Error('network-failure'))

      await expect(client.getConversationsById([CONVERSATION_ID])).rejects.toThrow('network-failure')
    })
  })

  describe('getAllConversationIds', () => {
    it('should return all conversation ids across multiple pages', async () => {
      vi.mocked(mockHttpClient.postRequest)
        .mockResolvedValueOnce({
          qualified_conversations: [CONVERSATION_ID],
          has_more: true,
          paging_state: 'page-2'
        })
        .mockResolvedValueOnce({
          qualified_conversations: [USER_ID],
          has_more: false,
          paging_state: null
        })

      const result = await client.getAllConversationIds()

      expect(mockHttpClient.postRequest).toHaveBeenCalledTimes(2)
      expect(result).toEqual([CONVERSATION_ID, USER_ID])
    })

    it('should return empty array when there are no conversations', async () => {
      vi.mocked(mockHttpClient.postRequest).mockResolvedValue({
        qualified_conversations: [],
        has_more: false,
        paging_state: null
      })

      const result = await client.getAllConversationIds()

      expect(result).toEqual([])
    })

    it('should propagate errors from postRequest', async () => {
      vi.mocked(mockHttpClient.postRequest).mockRejectedValue(new Error('network-failure'))

      await expect(client.getAllConversationIds()).rejects.toThrow('network-failure')
    })
  })

  describe('updateConversationMemberRole', () => {
    it('should call putRequest with the correct path and body', async () => {
      vi.mocked(mockHttpClient.putRequest).mockResolvedValue(undefined)

      await client.updateConversationMemberRole(CONVERSATION_ID, USER_ID, ConversationRole.ADMIN)

      expect(mockHttpClient.putRequest).toHaveBeenCalledWith(
        `conversations/${CONVERSATION_ID.domain}/${CONVERSATION_ID.id}/members/${USER_ID.domain}/${USER_ID.id}`,
        { conversation_role: ConversationRole.ADMIN }
      )
    })

    it('should propagate errors from putRequest', async () => {
      vi.mocked(mockHttpClient.putRequest).mockRejectedValue(new Error('network-failure'))

      await expect(
        client.updateConversationMemberRole(CONVERSATION_ID, USER_ID, ConversationRole.ADMIN)
      ).rejects.toThrow('network-failure')
    })
  })

  describe('createGroupConversation', () => {
    const CREATE_CONVERSATION_REQUEST = {
      name: 'Test Conversation',
      qualified_users: [USER_ID],
      team: { teamid: 'team-id' }
    } as any

    it('should call postRequest with the correct path and body', async () => {
      vi.mocked(mockHttpClient.postRequest).mockResolvedValue({ qualified_id: CONVERSATION_ID })

      await client.createGroupConversation(CREATE_CONVERSATION_REQUEST)

      expect(mockHttpClient.postRequest).toHaveBeenCalledWith(
        'conversations',
        CREATE_CONVERSATION_REQUEST
      )
    })

    it('should return the created conversation response', async () => {
      const mockConversationResponse = { qualified_id: CONVERSATION_ID, name: 'Test Conversation' }
      vi.mocked(mockHttpClient.postRequest).mockResolvedValue(mockConversationResponse)

      const result = await client.createGroupConversation(CREATE_CONVERSATION_REQUEST)

      expect(result).toEqual(mockConversationResponse)
    })

    it('should propagate errors from postRequest', async () => {
      vi.mocked(mockHttpClient.postRequest).mockRejectedValue(new Error('network-failure'))

      await expect(client.createGroupConversation(CREATE_CONVERSATION_REQUEST)).rejects.toThrow('network-failure')
    })
  })

  describe('leaveConversation', () => {
    it('should call deleteRequest with the correct path', async () => {
      vi.mocked(mockHttpClient.deleteRequest).mockResolvedValue(undefined)

      await client.leaveConversation(CONVERSATION_ID)

      expect(mockHttpClient.deleteRequest).toHaveBeenCalledWith(
        `conversations/${CONVERSATION_ID.domain}/${CONVERSATION_ID.id}/members/${WIRE_USER_DOMAIN}/${WIRE_USER_ID}`
      )
    })

    it('should propagate errors from deleteRequest', async () => {
      vi.mocked(mockHttpClient.deleteRequest).mockRejectedValue(new Error('network-failure'))

      await expect(client.leaveConversation(CONVERSATION_ID)).rejects.toThrow('network-failure')
    })
  })
})
