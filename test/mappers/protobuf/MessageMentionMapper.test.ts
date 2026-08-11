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

import { describe, expect, it } from 'vitest'
import type { Mention as ProtobufMention } from '../../../src/generated/messages.js'
import { MessageMentionMapper } from '../../../src/mappers/protobuf/MessageMentionMapper.js'
import { QualifiedId } from '../../../src/model/QualifiedId.js'
import type { Mention } from '../../../src/model/WireMessage.js'

describe('MessageMentionMapper', () => {
  it('maps Mention to protobuf', () => {
    const mention: Mention = {
      userId: new QualifiedId('user-id', 'wire.com'),
      offset: 5,
      length: 8
    }

    expect(MessageMentionMapper.toProtobuf(mention)).toStrictEqual({
      qualifiedUserId: {
        id: 'user-id',
        domain: 'wire.com'
      },
      start: 5,
      length: 8
    })
  })

  it('maps protobuf Mention to domain', () => {
    const mention: ProtobufMention.$Properties = {
      qualifiedUserId: {
        id: 'user-id',
        domain: 'wire.com'
      },
      start: 5,
      length: 8
    }

    expect(MessageMentionMapper.fromProtobuf(mention)).toStrictEqual({
      userId: new QualifiedId('user-id', 'wire.com'),
      offset: 5,
      length: 8
    })
  })

  it('skips protobuf Mention without qualified user id', () => {
    expect(MessageMentionMapper.fromProtobuf({ start: 5, length: 8 })).toBeNull()
  })
})
