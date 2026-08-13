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
import {UserType} from '../../src/model/UserType.js'

describe('WireUser', () => {
  const qualifiedId = new QualifiedId('user-123', 'example.com')
  const teamId = new TeamId('team-456')

  describe('constructor', () => {
    it('should store all provided properties', () => {
      const user = new WireUser(qualifiedId, 'John Doe', false, 'john@example.com', 'johndoe', teamId)

      expect(user.id).toBe(qualifiedId)
      expect(user.name).toBe('John Doe')
      expect(user.deleted).toBe(false)
      expect(user.email).toBe('john@example.com')
      expect(user.handle).toBe('johndoe')
      expect(user.teamId).toBe(teamId)
    })

    it('should allow optional fields to be undefined', () => {
      const user = new WireUser(qualifiedId, 'Jane Doe', false, undefined, undefined, undefined)

      expect(user.id).toBe(qualifiedId)
      expect(user.name).toBe('Jane Doe')
      expect(user.deleted).toBe(false)
      expect(user.email).toBeUndefined()
      expect(user.handle).toBeUndefined()
      expect(user.teamId).toBeUndefined()
      expect(user.type).toBeUndefined()
    })

    it('should store deleted as true when user is deleted', () => {
      const user = new WireUser(qualifiedId, 'Deleted User', true)

      expect(user.id).toBe(qualifiedId)
      expect(user.name).toBe('Deleted User')
      expect(user.deleted).toBe(true)
      expect(user.email).toBeUndefined()
      expect(user.handle).toBeUndefined()
      expect(user.teamId).toBeUndefined()
    })

    it('should correctly reference the QualifiedId', () => {
      const user = new WireUser(qualifiedId, 'John Doe', false, undefined, undefined, undefined)

      expect(user.id.id).toBe('user-123')
      expect(user.id.domain).toBe('example.com')
    })

    it('should correctly reference the TeamId', () => {
      const user = new WireUser(qualifiedId, 'John Doe', false, undefined, undefined, teamId)

      expect(user.teamId?.value).toBe('team-456')
    })

    it('should store the provided UserType', () => {
      const user = new WireUser(qualifiedId, 'John Doe', false, undefined, undefined, undefined, UserType.REGULAR)

      expect(user.type).toBe(UserType.REGULAR)
    })

    it('should allow type to be null', () => {
      const user = new WireUser(qualifiedId, 'John Doe', false, undefined, undefined, undefined, null)

      expect(user.type).toBeNull()
    })

    it('should store type as undefined when not provided', () => {
      const user = new WireUser(qualifiedId, 'John Doe', false)

      expect(user.type).toBeUndefined()
    })
  })
})
