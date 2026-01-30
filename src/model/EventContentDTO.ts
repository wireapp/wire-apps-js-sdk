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
import type {ConversationResponse} from "../api/response/ConversationResponse.js";

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

// TODO: Rename to TypingDTO in a separate PR for consistency
export interface Typing {
  type: string
  qualified_conversation: QualifiedId
}

export type EventContentDTO = MLSWelcomeDTO | NewMLSMessageDTO | NewConversationDTO | DeleteConversationDTO | Typing

// TODO: [Note from Baris] -> I think the following methods should be in the Router.
//  We don't need to pass "event" object to this class just to check 'type'.
//  I don't think it is this class' responsibility to check the type of the event.
//  This class should just provide the types and their schema.
//  I prefer making the refactoring after set of current tasks

// Type Guards
export function isNewMLSMessageEvent(event: EventContentDTO): event is NewMLSMessageDTO {
  return (event as NewMLSMessageDTO).type === "conversation.mls-message-add"
}

export function isMLSWelcomeEvent(event: EventContentDTO): event is MLSWelcomeDTO {
  return (event as MLSWelcomeDTO).type === "conversation.mls-welcome"
}

export function isNewConversationEvent(event: EventContentDTO): event is NewConversationDTO {
  return (event as NewConversationDTO).type === "conversation.create"
}

export function isDeleteConversationEvent(event: EventContentDTO): event is DeleteConversationDTO {
  return (event as DeleteConversationDTO).type === "conversation.delete"
}

export function isTypingEvent(event: EventContentDTO): event is Typing {
  return (event as Typing).type === "conversation.typing"
}
