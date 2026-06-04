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
import {WireUser} from '../../src/model/WireUser.js'
import {QualifiedId} from '../../src/model/QualifiedId.js'
import {TeamId} from '../../src/model/TeamId.js'

describe('WireUser', () => {
  const qualifiedId = new QualifiedId('user-123', 'example.com')
  const teamId = new TeamId('team-456')

  describe('constructor', () => {
    it('should store all provided properties', () => {
      const user = new WireUser(qualifiedId, 'John Doe', 'john@example.com', 'johndoe', teamId, false)

      expect(user.id).toBe(qualifiedId)
      expect(user.name).toBe('John Doe')
      expect(user.email).toBe('john@example.com')
      expect(user.handle).toBe('johndoe')
      expect(user.teamId).toBe(teamId)
      expect(user.deleted).toBe(false)
    })

    it('should allow optional fields to be undefined', () => {
      const user = new WireUser(qualifiedId, 'Jane Doe', undefined, undefined, undefined, undefined)

      expect(user.id).toBe(qualifiedId)
      expect(user.name).toBe('Jane Doe')
      expect(user.email).toBeUndefined()
      expect(user.handle).toBeUndefined()
      expect(user.teamId).toBeUndefined()
      expect(user.deleted).toBeUndefined()
    })

    it('should store deleted as true when user is deleted', () => {
      const user = new WireUser(qualifiedId, 'Deleted User', undefined, undefined, undefined, true)

      expect(user.deleted).toBe(true)
    })

    it('should correctly reference the QualifiedId', () => {
      const user = new WireUser(qualifiedId, 'John Doe', undefined, undefined, undefined, undefined)

      expect(user.id.id).toBe('user-123')
      expect(user.id.domain).toBe('example.com')
    })

    it('should correctly reference the TeamId', () => {
      const user = new WireUser(qualifiedId, 'John Doe', undefined, undefined, teamId, undefined)

      expect(user.teamId?.value).toBe('team-456')
    })
  })
})

