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

import type {ConversationEntity} from '../../db/model/ConversationEntity.js'
import type {Conversation} from '../../model/conversation/Conversation.js'

export class ConversationMapper {
  static fromEntity(conversationEntity: ConversationEntity): Conversation {
    return {
      id: conversationEntity.id,
      domain: conversationEntity.domain,
      name: conversationEntity.name,
      type: conversationEntity.type,
      teamId: conversationEntity.teamId,
      messageTimer: conversationEntity.messageTimer ?? null
    }
  }
}
