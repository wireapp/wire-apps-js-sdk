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

import type {QualifiedId} from "../../model/QualifiedId.js"
import {CryptoProtocol} from "../../model/CryptoProtocol.js"
import {ConversationAccess} from "../../model/conversation/ConversationAccess.js"
import {ConversationAccessRole} from "../../model/conversation/ConversationAccessRole.js"
import {GroupConversationType} from "../../model/conversation/GroupConversationType.js"
import {ChannelAddPermissionType} from "../../model/conversation/ChannelAddPermissionType.js"
import {ReceiptMode} from "../../model/conversation/ReceiptMode.js"
import type {ConversationTeamInfo} from "../model/ConversationTeamInfo.js"
import type {TeamId} from "../../model/TeamId.js"

export const DEFAULT_MEMBER_ROLE = "wire_member"

export const DEFAULT_ACCESS_LIST: ConversationAccess[] = [
  ConversationAccess.INVITE,
  ConversationAccess.CODE
]

export const DEFAULT_ACCESS_ROLE_LIST: ConversationAccessRole[] = [
  ConversationAccessRole.GUEST,
  ConversationAccessRole.NON_TEAM_MEMBER,
  ConversationAccessRole.TEAM_MEMBER,
  ConversationAccessRole.SERVICE
]

export interface CreateConversationRequest {
  qualified_users: QualifiedId[]
  name: string | null
  access: ConversationAccess[]
  access_role: ConversationAccessRole[]
  group_conv_type: GroupConversationType | null
  add_permission: ChannelAddPermissionType
  team: ConversationTeamInfo | null
  message_timer: number | null
  receipt_mode: ReceiptMode
  conversation_role: string
  protocol: CryptoProtocol
  cells: boolean
  skip_creator: boolean
}

export function createGroupConversationRequest(name: string, teamId: TeamId): CreateConversationRequest {
  return createBaseConversationRequest(name, teamId, {group_conv_type: GroupConversationType.REGULAR_GROUP})
}

export function createChannelConversationRequest(name: string, teamId: TeamId): CreateConversationRequest {
  return createBaseConversationRequest(name, teamId, {group_conv_type: GroupConversationType.CHANNEL})
}

function createBaseConversationRequest(
  name: string,
  teamId: TeamId,
  overrides: Partial<CreateConversationRequest> = {}
): CreateConversationRequest {
  return {
    qualified_users: [],
    name,
    access: DEFAULT_ACCESS_LIST,
    access_role: DEFAULT_ACCESS_ROLE_LIST,
    group_conv_type: null,
    add_permission: ChannelAddPermissionType.ADMINS,
    team: {managed: false, teamid: teamId.value},
    message_timer: null,
    receipt_mode: ReceiptMode.DISABLED,
    conversation_role: DEFAULT_MEMBER_ROLE,
    protocol: CryptoProtocol.MLS,
    cells: false,
    skip_creator: false,
    ...overrides
  }
}
