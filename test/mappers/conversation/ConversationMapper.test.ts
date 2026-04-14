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

import { describe, expect, it } from 'vitest'
import { ConversationMapper } from '../../../src/mappers/conversation/ConversationMapper.js'
import type {ConversationEntity} from '../../../src/db/model/ConversationEntity.js'
import type {Conversation} from '../../../src/model/conversation/Conversation.js'
import { ConversationType } from '../../../src/model/conversation/ConversationType.js'

describe("Conversation Mapping", () => {
  it("from DB Entity to Domain Conversation", () => {
    const conversationId = "550e8400-e29b-41d4-a716-446655440000"
    const conversationDomain = "wire.com"
    const conversationName = "Test Conversation"
    const conversationTeamId = "550e8400-e29b-41d4-a716-446655440001"

    const conversationEntity: ConversationEntity = {
      id: conversationId,
      domain: conversationDomain,
      name: conversationName,
      team_id: conversationTeamId,
      mls_group_id: "dummyMlsGroupId",
      creation_date: null,
      type: ConversationType.GROUP
    }

    const expected: Conversation = {
      id: conversationEntity.id,
      domain: conversationEntity.domain,
      name: conversationEntity.name,
      type: ConversationType.GROUP,
      teamId: conversationTeamId
    }

    const result = ConversationMapper.fromEntity(conversationEntity)

    expect(result).toStrictEqual(expected)
  })
})
