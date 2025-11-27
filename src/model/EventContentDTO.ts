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

import type { QualifiedId } from "./QualifiedId.js"

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

export type EventContentDTO = MLSWelcomeDTO | NewMLSMessageDTO

// Type Guards
export function isNewMLSMessageEvent(event: EventContentDTO): event is NewMLSMessageDTO {
  return (event as NewMLSMessageDTO).type === "conversation.mls-message-add"
}

export function isMLSWelcomeEvent(event: EventContentDTO): event is MLSWelcomeDTO {
  return (event as MLSWelcomeDTO).type === "conversation.mls-welcome"
}
