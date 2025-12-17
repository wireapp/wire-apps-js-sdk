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
import { obfuscateId, obfuscateClientId } from '../../src/utils/ObfuscateUtil.js'

describe("Id obfuscation", () => {
  it("when obfuscating an Id, then returned value is correctly obfuscated", () => {
    const valueToBeObfuscated = "550e8400-e29b-41d4-a716-446655440000"
    const expected = "550e840***"

    const result = obfuscateId(valueToBeObfuscated)

    expect(result).toBe(expected)
  })

  it("when obfuscating a client Id, then returned value is correctly obfuscated", () => {
    const valueToBeObfuscated = "7cdd013ce3b8d5bf"
    const expected = "7cd***"

    const result = obfuscateClientId(valueToBeObfuscated)

    expect(result).toBe(expected)
  })
})
