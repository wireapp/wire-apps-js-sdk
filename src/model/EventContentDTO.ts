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

import type {QualifiedId} from './QualifiedId.js'
import type {ConversationResponse} from '../api/response/ConversationResponse.js'
import type {ConversationRole} from './conversation/ConversationRole.js'

export interface MLSWelcomeDTO {
  type: string
  data: string
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
  time: Date
}

export interface NewMLSMessageDTO {
  type: string
  data: string
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
  time: Date
}

export interface NewConversationDTO {
  type: string
  time: Date
  data: ConversationResponse
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
}

export interface DeleteConversationDTO {
  type: string
  time: Date
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
}

export interface TypingDTO {
  type: string
  qualified_conversation: QualifiedId
}

export interface MemberJoinDTO {
  type: string
  time: Date
  data: MemberJoinEventData
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
}

interface MemberJoinEventData {
  users: MemberData[]
}

interface MemberData {
  qualified_id: QualifiedId
  conversation_role: ConversationRole
}

export interface MemberLeaveDTO {
  type: string
  time: Date
  data: MemberLeaveEventData
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
}

interface MemberLeaveEventData {
  qualified_user_ids: QualifiedId[]
  reason: string
}

export interface MemberUpdateDTO {
  type: string
  time: Date
  data: MemberRoleChangeData
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
}

interface MemberRoleChangeData {
  qualified_target: QualifiedId
  conversation_role: ConversationRole
}

export interface MlsResetDTO {
  type: string
  time: Date
  data: MlsConversationResetData
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
}

interface MlsConversationResetData {
  group_id: string
  new_group_id: string
}

export interface MessageTimerUpdateDTO {
  type: string
  time: Date
  data: MessageTimerUpdateEventData
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
}

interface MessageTimerUpdateEventData {
  message_timer: number | null
}

export type EventContentDTO =
  | MLSWelcomeDTO
  | NewMLSMessageDTO
  | NewConversationDTO
  | DeleteConversationDTO
  | TypingDTO
  | MemberJoinDTO
  | MemberLeaveDTO
  | MemberUpdateDTO
  | MlsResetDTO
  | MessageTimerUpdateDTO
