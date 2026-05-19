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
import {QualifiedId} from '../../src/model/QualifiedId.js'

describe('QualifiedId', () => {
  describe('constructor', () => {
    it('should create a QualifiedId with id and domain', () => {
      const id = 'user-123'
      const domain = 'example.com'

      const qualifiedId = new QualifiedId(id, domain)

      expect(qualifiedId.id).toBe(id)
      expect(qualifiedId.domain).toBe(domain)
    })

    it('should create a QualifiedId with UUID id', () => {
      const id = '550e8400-e29b-41d4-a716-446655440000'
      const domain = 'staging.zinfra.io'

      const qualifiedId = new QualifiedId(id, domain)

      expect(qualifiedId.id).toBe(id)
      expect(qualifiedId.domain).toBe(domain)
    })
  })

  describe('toString', () => {
    it('should return obfuscated id with domain when id length is greater than threshold', () => {
      const id = '550e8400-e29b-41d4-a716-446655440000'
      const domain = 'staging.zinfra.io'
      const qualifiedId = new QualifiedId(id, domain)

      expect(qualifiedId.toString()).toBe('550e840***@staging.zinfra.io')
    })

    it('should return original id with domain when id is shorter than obfuscation threshold', () => {
      const id = 'abc'
      const domain = 'example.com'
      const qualifiedId = new QualifiedId(id, domain)

      expect(qualifiedId.toString()).toBe('abc@example.com')
    })

    it('should obfuscate when id length equals threshold (7)', () => {
      const id = '1234567'
      const domain = 'wire.com'
      const qualifiedId = new QualifiedId(id, domain)

      expect(qualifiedId.toString()).toBe('1234567***@wire.com')
    })

    it('should handle real UUID format correctly', () => {
      const id = '218b539c-48d8-4c89-a4ea-bc28fae2bb1d'
      const domain = 'staging.zinfra.io'
      const qualifiedId = new QualifiedId(id, domain)

      expect(qualifiedId.toString()).toBe('218b539***@staging.zinfra.io')
    })

    it('should work correctly in string interpolation', () => {
      const id = '550e8400-e29b-41d4-a716-446655440000'
      const domain = 'example.com'
      const qualifiedId = new QualifiedId(id, domain)

      const message = `User ID: ${qualifiedId}`

      expect(message).toBe('User ID: 550e840***@example.com')
    })

    it('should handle different domain formats', () => {
      const id = '12345678'
      const domain = 'subdomain.example.co.uk'
      const qualifiedId = new QualifiedId(id, domain)

      expect(qualifiedId.toString()).toBe('1234567***@subdomain.example.co.uk')
    })
  })


  describe('instanceof checks', () => {
    it('should correctly identify QualifiedId instances', () => {
      const qualifiedId = new QualifiedId('user-id', 'example.com')

      expect(qualifiedId instanceof QualifiedId).toBe(true)
    })

    it('should distinguish from plain objects', () => {
      const plainObject = { id: 'user-id', domain: 'example.com' }

      expect(plainObject instanceof QualifiedId).toBe(false)
    })
  })
})

