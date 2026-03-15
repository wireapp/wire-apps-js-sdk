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
import {EventRouter} from '../../src/core/EventRouter.js'
import type {EventResponse} from '../../src/api/response/EventResponse.js'
import type {
  NewConversationDTO,
  MemberJoinDTO,
  MemberLeaveDTO,
  MemberUpdateDTO,
  TeamInviteDTO,
} from '../../src/model/EventContentDTO.js'

const makeEventResponse = (payload: EventResponse['payload']): EventResponse => ({
  id: 'event-id',
  transient: false,
  payload,
})

const CONV_ID = {id: 'conv-123', domain: 'wire.com'}
const USER_A = {id: 'user-a', domain: 'wire.com'}
const USER_B = {id: 'user-b', domain: 'wire.com'}

describe('EventRouter', () => {
  let mockConversationService: any
  let mockWireEventsHandler: any
  let router: EventRouter

  beforeEach(() => {
    mockConversationService = {
      saveConversationWithMembers: vi.fn().mockResolvedValue({conversation: {}, members: []}),
      deleteAllConversationDataFromLocalStorages: vi.fn().mockResolvedValue(undefined),
      addMembers: vi.fn().mockResolvedValue(undefined),
      removeMembers: vi.fn().mockResolvedValue(undefined),
      updateMember: vi.fn().mockResolvedValue(undefined),
      getConversationMLSGroupId: vi.fn().mockResolvedValue('group-id'),
    }

    mockWireEventsHandler = {
      onConversationDeleted: vi.fn().mockResolvedValue(undefined),
      onUserJoinedConversation: vi.fn().mockResolvedValue(undefined),
      onUserLeftConversation: vi.fn().mockResolvedValue(undefined),
      onAppAddedToConversation: vi.fn().mockResolvedValue(undefined),
    }

    router = new EventRouter(
      {} as any,
      mockConversationService,
      {} as any,
      {} as any,
      mockWireEventsHandler
    )
  })

  describe('conversation.create', () => {
    it('saves conversation with members', async () => {
      const event: NewConversationDTO = {
        type: 'conversation.create',
        time: new Date(),
        qualified_conversation: CONV_ID,
        qualified_from: USER_A,
        data: {name: 'Test Room'} as any,
      }

      await router.route(makeEventResponse([event]))

      expect(mockConversationService.saveConversationWithMembers).toHaveBeenCalledWith(CONV_ID, event.data)
    })
  })

  describe('conversation.member-join', () => {
    it('adds members and fires onUserJoinedConversation', async () => {
      const event: MemberJoinDTO = {
        type: 'conversation.member-join',
        time: new Date(),
        qualified_conversation: CONV_ID,
        qualified_from: USER_A,
        data: {
          users: [
            {qualified_id: USER_A, conversation_role: 'wire_member'},
            {qualified_id: USER_B, conversation_role: 'wire_member'},
          ],
        },
      }

      await router.route(makeEventResponse([event]))

      expect(mockConversationService.addMembers).toHaveBeenCalledWith(
        [{userId: USER_A, role: 'wire_member'}, {userId: USER_B, role: 'wire_member'}],
        CONV_ID
      )
      expect(mockWireEventsHandler.onUserJoinedConversation).toHaveBeenCalledWith(CONV_ID, expect.any(Array))
    })
  })

  describe('conversation.member-leave', () => {
    it('removes members and fires onUserLeftConversation', async () => {
      const event: MemberLeaveDTO = {
        type: 'conversation.member-leave',
        time: new Date(),
        qualified_conversation: CONV_ID,
        qualified_from: USER_A,
        data: {qualified_user_ids: [USER_B], reason: 'left'},
      }

      await router.route(makeEventResponse([event]))

      expect(mockConversationService.removeMembers).toHaveBeenCalledWith([USER_B], CONV_ID)
      expect(mockWireEventsHandler.onUserLeftConversation).toHaveBeenCalledWith(CONV_ID, [USER_B])
    })
  })

  describe('conversation.member-update', () => {
    it('updates the member role', async () => {
      const event: MemberUpdateDTO = {
        type: 'conversation.member-update',
        time: new Date(),
        qualified_conversation: CONV_ID,
        qualified_from: USER_A,
        data: {qualified_target: USER_B, conversation_role: 'wire_admin'},
      }

      await router.route(makeEventResponse([event]))

      expect(mockConversationService.updateMember).toHaveBeenCalledWith(USER_B, CONV_ID, 'wire_admin')
    })
  })

  describe('team.invite', () => {
    it('is silently ignored — no service calls made', async () => {
      const event: TeamInviteDTO = {
        type: 'team.invite',
        team: 'team-123',
      }

      await router.route(makeEventResponse([event]))

      expect(mockConversationService.saveConversationWithMembers).not.toHaveBeenCalled()
      expect(mockConversationService.addMembers).not.toHaveBeenCalled()
      expect(mockWireEventsHandler.onUserJoinedConversation).not.toHaveBeenCalled()
    })
  })

  describe('conversation.typing', () => {
    it('is silently ignored', async () => {
      const event = {type: 'conversation.typing', qualified_conversation: CONV_ID}

      await router.route(makeEventResponse([event as any]))

      expect(mockConversationService.saveConversationWithMembers).not.toHaveBeenCalled()
    })
  })
})
