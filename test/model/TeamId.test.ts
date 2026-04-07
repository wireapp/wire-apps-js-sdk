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

import {describe, expect, it} from 'vitest'
import {TeamId} from '../../src/model/TeamId.js'

describe('TeamId', () => {
  it('toString returns obfuscated id when length is greater than threshold', () => {
    const id = 'team-123456789'
    const teamId = new TeamId(id)

    expect(teamId.toString()).toBe('team-12***')
  })

  it('toString returns original id when shorter than obfuscation threshold', () => {
    const id = 'abc'
    const teamId = new TeamId(id)

    expect(teamId.toString()).toBe('abc')
  })

  it('toString obfuscates when id length equals threshold (7)', () => {
    const id = '1234567'
    const teamId = new TeamId(id)

    expect(teamId.toString()).toBe('1234567***')
  })
})


