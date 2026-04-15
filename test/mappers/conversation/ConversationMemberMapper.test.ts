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

import { describe, it, expect } from 'vitest'
import { ConversationMemberMapper } from '../../../src/mappers/conversation/ConversationMemberMapper.js'
import type { ConversationMemberEntity } from '../../../src/db/model/ConversationMemberEntity.js'
import { ConversationRole } from '../../../src/model/conversation/ConversationRole.js'

describe('ConversationMemberMapper', () => {

  it('should map ConversationMemberEntity to ConversationMember correctly', () => {
    const entity: ConversationMemberEntity = {
      user_id: 'user-1',
      user_domain: 'wire.com',
      conversation_id: 'conv-1',
      conversation_domain: 'wire.com',
      role: ConversationRole.ADMIN,
      creation_date: null
    }

    const result = ConversationMemberMapper.fromEntity(entity)

    expect(result).toEqual({
      userId: {
        id: 'user-1',
        domain: 'wire.com'
      },
      role: ConversationRole.ADMIN
    })
  })

  it('should map MEMBER role correctly', () => {
    const entity: ConversationMemberEntity = {
      user_id: 'user-2',
      user_domain: 'example.com',
      conversation_id: 'conv-2',
      conversation_domain: 'example.com',
      role: ConversationRole.MEMBER,
      creation_date: null
    }

    const result = ConversationMemberMapper.fromEntity(entity)

    expect(result.userId.id).toBe('user-2')
    expect(result.userId.domain).toBe('example.com')
    expect(result.role).toBe(ConversationRole.MEMBER)
  })

  it('should ignore conversation-related fields from entity', () => {
    const entity: ConversationMemberEntity = {
      user_id: 'user-3',
      user_domain: 'wire.com',
      conversation_id: 'conv-ignored',
      conversation_domain: 'ignored-domain',
      role: ConversationRole.MEMBER,
      creation_date: null
    }

    const result = ConversationMemberMapper.fromEntity(entity)

    // Ensure only domain model shape exists
    expect(result).not.toHaveProperty('conversation_id')
    expect(result).not.toHaveProperty('conversation_domain')
  })

  it('should handle unknown role values via casting', () => {
    const entity: ConversationMemberEntity = {
      user_id: 'user-4',
      user_domain: 'wire.com',
      conversation_id: 'conv-4',
      conversation_domain: 'wire.com',
      role: 'wire_custom_role' as any, // simulate unexpected backend value
      creation_date: null
    }

    const result = ConversationMemberMapper.fromEntity(entity)

    // Since mapper uses casting, it should pass through
    expect(result.role).toBe('wire_custom_role')
  })

  it('should map multiple entities consistently', () => {
    const entities: ConversationMemberEntity[] = [
      {
        user_id: 'user-1',
        user_domain: 'wire.com',
        conversation_id: 'conv',
        conversation_domain: 'wire.com',
        role: ConversationRole.ADMIN,
        creation_date: null
      },
      {
        user_id: 'user-2',
        user_domain: 'wire.com',
        conversation_id: 'conv',
        conversation_domain: 'wire.com',
        role: ConversationRole.MEMBER,
        creation_date: null
      }
    ]

    const results = entities.map(ConversationMemberMapper.fromEntity)

    expect(results).toHaveLength(2)

    expect(results[0]).toEqual({
      userId: { id: 'user-1', domain: 'wire.com' },
      role: ConversationRole.ADMIN
    })

    expect(results[1]).toEqual({
      userId: { id: 'user-2', domain: 'wire.com' },
      role: ConversationRole.MEMBER
    })
  })

})
