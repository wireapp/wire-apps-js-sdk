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

import type {QualifiedId} from "./QualifiedId.js"
import type {UUID} from "node:crypto";

// TODO: [Question from Baris] -> Do we have to use DTO suffix for some of these class names?
//  If not, we better remove for naming consistency

export interface MLSWelcomeDTO {
  type: string
  time: Date
  data: string
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
}

export interface NewMLSMessageDTO {
  type: string
  time: Date
  data: string
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
}

export interface NewConversationDTO {
  type: string
  time: Date
  data: string
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
}

export interface DeleteConversation {
  type: string
  time: Date
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
}

export interface MemberJoin {
  type: string
  time: Date
  data: string
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
}

export interface MemberUpdateDTO {
  type: string
  time: Date
  data: string
  from: string
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
}

export interface MemberLeave {
  type: string
  time: Date
  data: string
  qualified_conversation: QualifiedId
  qualified_from: QualifiedId
}

export interface Typing {
  type: string
  qualified_conversation: QualifiedId
}

export interface TeamInvite {
  type: string
  team_id: UUID
}

export type EventContentDTO = MLSWelcomeDTO | NewMLSMessageDTO | NewConversationDTO |
  DeleteConversation | MemberJoin | MemberUpdateDTO | MemberLeave | Typing | TeamInvite


// TODO: [Note from Baris] -> I think the following methods should be in the Router.
//  We don't need to pass "event" object to this class just to check 'type'.
//  I don't think it is this class' responsibility to check the type of the event.
//  This class should just provide the types and their schema.

// Type Guards
export function isNewMLSMessageEvent(event: EventContentDTO): event is NewMLSMessageDTO {
  return (event as NewMLSMessageDTO).type === "conversation.mls-message-add"
}

export function isMLSWelcomeEvent(event: EventContentDTO): event is MLSWelcomeDTO {
  return (event as MLSWelcomeDTO).type === "conversation.mls-welcome"
}

export function isNewConversationEvent(event: EventContentDTO): event is NewConversationDTO {
  return (event as MLSWelcomeDTO).type === "conversation.create"
}

export function isDeleteConversationEvent(event: EventContentDTO): event is DeleteConversation {
  return (event as MLSWelcomeDTO).type === "conversation.delete"
}

export function isMemberJoinEvent(event: EventContentDTO): event is MemberJoin {
  return (event as MemberJoin).type === "conversation.member-join"
}

export function isMemberUpdateEvent(event: EventContentDTO): event is MemberUpdateDTO {
  return (event as MemberUpdateDTO).type === "conversation.member-update"
}

export function isMemberLeaveEvent(event: EventContentDTO): event is MemberLeave {
  return (event as MemberLeave).type === "conversation.member-leave"
}

export function isTypingEvent(event: EventContentDTO): event is Typing {
  return (event as Typing).type === "conversation.typing"
}

export function isTeamInviteEvent(event: EventContentDTO): event is TeamInvite {
  return (event as TeamInvite).type === "team.invite"
}
