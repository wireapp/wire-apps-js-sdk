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
import { ConversationTypeMapper } from '../../../src/mappers/conversation/ConversationTypeMapper.js'
import { ConversationType } from "../../../src/model/conversation/ConversationType.js"

describe("Conversation Type Mapping", () => {
  it("from GROUP string value to Domain ConversationType class", () => {
    const value = "0"
    const expected = ConversationType.GROUP

    const result = ConversationTypeMapper.toModel(value)

    expect(result).toBe(expected)
  })

  it("from SELF string value to Domain ConversationType class", () => {
    const value = "1"
    const expected = ConversationType.SELF

    const result = ConversationTypeMapper.toModel(value)

    expect(result).toBe(expected)
  })

  it("from ONE_TO_ONE string value to Domain ConversationType class", () => {
    const value = "2"
    const expected = ConversationType.ONE_TO_ONE

    const result = ConversationTypeMapper.toModel(value)

    expect(result).toBe(expected)
  })

  it("from unknown string value to Domain ConversationType class", () => {
    const value = "9999"
    const expected = ConversationType.GROUP

    const result = ConversationTypeMapper.toModel(value)

    expect(result).toBe(expected)
  })
})
