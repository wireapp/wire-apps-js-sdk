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

import type {ConversationMemberEntity} from '../../db/model/ConversationMemberEntity.js'
import type {ConversationMember} from '../../model/conversation/ConversationMember.js'
import type {ConversationRole} from '../../model/conversation/ConversationRole.js'
import {QualifiedId} from '../../model/QualifiedId.js'

export class ConversationMemberMapper {
  static fromEntity(entity: ConversationMemberEntity): ConversationMember {
    return {
      userId: new QualifiedId(entity.userId, entity.userDomain),
      role: entity.role as ConversationRole
    }
  }
}
