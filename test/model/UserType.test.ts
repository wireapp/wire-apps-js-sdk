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
import {UserType} from '../../src/model/UserType.js'

describe('UserType', () => {
  it('should have REGULAR with value "regular"', () => {
    expect(UserType.REGULAR).toBe('regular')
  })

  it('should have APP with value "app"', () => {
    expect(UserType.APP).toBe('app')
  })

  it('should have BOT with value "bot"', () => {
    expect(UserType.BOT).toBe('bot')
  })

  it('should contain exactly three values', () => {
    const values = Object.values(UserType)
    expect(values).toHaveLength(3)
  })

  it('should match the string values returned by the backend', () => {
    expect(Object.values(UserType)).toEqual(expect.arrayContaining(['regular', 'app', 'bot']))
  })
})
