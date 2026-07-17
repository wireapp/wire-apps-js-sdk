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

import {describe, it, expect} from 'vitest'
import {
  createGroupConversationRequest,
  createChannelConversationRequest,
  DEFAULT_MEMBER_ROLE,
  DEFAULT_ACCESS_LIST,
  DEFAULT_ACCESS_ROLE_LIST,
} from '../../src/api/request/CreateConversationRequest.js'
import {TeamId} from '../../src/model/TeamId.js'
import {CryptoProtocol} from '../../src/model/CryptoProtocol.js'
import {ConversationAccess} from '../../src/model/conversation/ConversationAccess.js'
import {ConversationAccessRole} from '../../src/model/conversation/ConversationAccessRole.js'
import {GroupConversationType} from '../../src/model/conversation/GroupConversationType.js'
import {ChannelAddPermissionType} from '../../src/model/conversation/ChannelAddPermissionType.js'
import {ReceiptMode} from '../../src/model/conversation/ReceiptMode.js'

const TEAM_ID = new TeamId('team-uuid-123')
const CONVERSATION_NAME = 'My Conversation'

describe('CreateConversationRequest', () => {
  describe('DEFAULT_ACCESS_LIST', () => {
    it('should contain INVITE and CODE access types', () => {
      expect(DEFAULT_ACCESS_LIST).toEqual([
        ConversationAccess.INVITE,
        ConversationAccess.CODE,
      ])
    })
  })

  describe('DEFAULT_ACCESS_ROLE_LIST', () => {
    it('should contain GUEST, NON_TEAM_MEMBER, TEAM_MEMBER and SERVICE roles', () => {
      expect(DEFAULT_ACCESS_ROLE_LIST).toEqual([
        ConversationAccessRole.GUEST,
        ConversationAccessRole.NON_TEAM_MEMBER,
        ConversationAccessRole.TEAM_MEMBER,
        ConversationAccessRole.SERVICE,
      ])
    })
  })

  describe('createGroupConversationRequest', () => {
    it('should set the given name', () => {
      const request = createGroupConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.name).toBe(CONVERSATION_NAME)
    })

    it('should set the team info from the given teamId', () => {
      const request = createGroupConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.team).toEqual({managed: false, teamid: TEAM_ID.value})
    })

    it('should set group_conv_type to REGULAR_GROUP', () => {
      const request = createGroupConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.group_conv_type).toBe(GroupConversationType.REGULAR_GROUP)
    })

    it('should start with an empty qualified_users list', () => {
      const request = createGroupConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.qualified_users).toEqual([])
    })

    it('should use the MLS protocol', () => {
      const request = createGroupConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.protocol).toBe(CryptoProtocol.MLS)
    })

    it('should use the default access list', () => {
      const request = createGroupConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.access).toEqual(DEFAULT_ACCESS_LIST)
    })

    it('should use the default access role list', () => {
      const request = createGroupConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.access_role).toEqual(DEFAULT_ACCESS_ROLE_LIST)
    })

    it('should set add_permission to ADMINS', () => {
      const request = createGroupConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.add_permission).toBe(ChannelAddPermissionType.ADMINS)
    })

    it('should set receipt_mode to DISABLED', () => {
      const request = createGroupConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.receipt_mode).toBe(ReceiptMode.DISABLED)
    })

    it('should use the default member conversation_role', () => {
      const request = createGroupConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.conversation_role).toBe(DEFAULT_MEMBER_ROLE)
    })

    it('should set message_timer to null', () => {
      const request = createGroupConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.message_timer).toBeNull()
    })

    it('should set cells to false', () => {
      const request = createGroupConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.cells).toBe(false)
    })

    it('should set skip_creator to false', () => {
      const request = createGroupConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.skip_creator).toBe(false)
    })
  })

  describe('createChannelConversationRequest', () => {
    it('should set the given name', () => {
      const request = createChannelConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.name).toBe(CONVERSATION_NAME)
    })

    it('should set the team info from the given teamId', () => {
      const request = createChannelConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.team).toEqual({managed: false, teamid: TEAM_ID.value})
    })

    it('should set group_conv_type to CHANNEL', () => {
      const request = createChannelConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.group_conv_type).toBe(GroupConversationType.CHANNEL)
    })

    it('should start with an empty qualified_users list', () => {
      const request = createChannelConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.qualified_users).toEqual([])
    })

    it('should use the MLS protocol', () => {
      const request = createChannelConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.protocol).toBe(CryptoProtocol.MLS)
    })

    it('should use the default access list', () => {
      const request = createChannelConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.access).toEqual(DEFAULT_ACCESS_LIST)
    })

    it('should use the default access role list', () => {
      const request = createChannelConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.access_role).toEqual(DEFAULT_ACCESS_ROLE_LIST)
    })

    it('should set add_permission to ADMINS', () => {
      const request = createChannelConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.add_permission).toBe(ChannelAddPermissionType.ADMINS)
    })

    it('should set receipt_mode to DISABLED', () => {
      const request = createChannelConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.receipt_mode).toBe(ReceiptMode.DISABLED)
    })

    it('should use the default member conversation_role', () => {
      const request = createChannelConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.conversation_role).toBe(DEFAULT_MEMBER_ROLE)
    })

    it('should set message_timer to null', () => {
      const request = createChannelConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.message_timer).toBeNull()
    })

    it('should set cells to false', () => {
      const request = createChannelConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.cells).toBe(false)
    })

    it('should set skip_creator to false', () => {
      const request = createChannelConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(request.skip_creator).toBe(false)
    })
  })

  describe('createGroupConversationRequest vs createChannelConversationRequest', () => {
    it('should differ only in group_conv_type', () => {
      const groupRequest = createGroupConversationRequest(CONVERSATION_NAME, TEAM_ID)
      const channelRequest = createChannelConversationRequest(CONVERSATION_NAME, TEAM_ID)

      expect(groupRequest.group_conv_type).toBe(GroupConversationType.REGULAR_GROUP)
      expect(channelRequest.group_conv_type).toBe(GroupConversationType.CHANNEL)

      // All other fields are identical
      const {group_conv_type: _g, ...groupRest} = groupRequest
      const {group_conv_type: _c, ...channelRest} = channelRequest
      expect(groupRest).toEqual(channelRest)
    })
  })
})

