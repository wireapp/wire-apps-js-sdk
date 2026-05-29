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

  describe('toKey', () => {
    it('should create a consistent string key from QualifiedId', () => {
      const qualifiedId = new QualifiedId('user-123', 'example.com')

      const key = QualifiedId.toKey(qualifiedId)

      expect(key).toBe('user-123:example.com')
    })

    it('should handle UUID ids correctly', () => {
      const qualifiedId = new QualifiedId('550e8400-e29b-41d4-a716-446655440000', 'staging.zinfra.io')

      const key = QualifiedId.toKey(qualifiedId)

      expect(key).toBe('550e8400-e29b-41d4-a716-446655440000:staging.zinfra.io')
    })

    it('should create same key for identical QualifiedIds', () => {
      const qualifiedId1 = new QualifiedId('user-id', 'example.com')
      const qualifiedId2 = new QualifiedId('user-id', 'example.com')

      const key1 = QualifiedId.toKey(qualifiedId1)
      const key2 = QualifiedId.toKey(qualifiedId2)

      expect(key1).toBe(key2)
    })

    it('should create different keys for different domains', () => {
      const qualifiedId1 = new QualifiedId('user-id', 'example.com')
      const qualifiedId2 = new QualifiedId('user-id', 'other.com')

      const key1 = QualifiedId.toKey(qualifiedId1)
      const key2 = QualifiedId.toKey(qualifiedId2)

      expect(key1).not.toBe(key2)
      expect(key1).toBe('user-id:example.com')
      expect(key2).toBe('user-id:other.com')
    })

    it('should create different keys for different user ids', () => {
      const qualifiedId1 = new QualifiedId('user-1', 'example.com')
      const qualifiedId2 = new QualifiedId('user-2', 'example.com')

      const key1 = QualifiedId.toKey(qualifiedId1)
      const key2 = QualifiedId.toKey(qualifiedId2)

      expect(key1).not.toBe(key2)
      expect(key1).toBe('user-1:example.com')
      expect(key2).toBe('user-2:example.com')
    })
  })

  describe('fromKey', () => {
    it('should reconstruct QualifiedId from a key string', () => {
      const key = 'user-123:example.com'

      const qualifiedId = QualifiedId.fromKey(key)

      expect(qualifiedId.id).toBe('user-123')
      expect(qualifiedId.domain).toBe('example.com')
      expect(qualifiedId instanceof QualifiedId).toBe(true)
    })

    it('should handle UUID ids in key correctly', () => {
      const key = '550e8400-e29b-41d4-a716-446655440000:staging.zinfra.io'

      const qualifiedId = QualifiedId.fromKey(key)

      expect(qualifiedId.id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(qualifiedId.domain).toBe('staging.zinfra.io')
    })

    it('should handle subdomain in key correctly', () => {
      const key = 'user-id:subdomain.example.co.uk'

      const qualifiedId = QualifiedId.fromKey(key)

      expect(qualifiedId.id).toBe('user-id')
      expect(qualifiedId.domain).toBe('subdomain.example.co.uk')
    })
  })

  describe('toKey and fromKey round-trip', () => {
    it('should correctly round-trip a QualifiedId through key conversion', () => {
      const original = new QualifiedId('user-123', 'example.com')

      const key = QualifiedId.toKey(original)
      const reconstructed = QualifiedId.fromKey(key)

      expect(reconstructed.id).toBe(original.id)
      expect(reconstructed.domain).toBe(original.domain)
    })

    it('should work with UUID ids', () => {
      const original = new QualifiedId('550e8400-e29b-41d4-a716-446655440000', 'staging.zinfra.io')

      const key = QualifiedId.toKey(original)
      const reconstructed = QualifiedId.fromKey(key)

      expect(reconstructed.id).toBe(original.id)
      expect(reconstructed.domain).toBe(original.domain)
    })

    it('should work with complex domain names', () => {
      const original = new QualifiedId('user-id', 'subdomain.example.co.uk')

      const key = QualifiedId.toKey(original)
      const reconstructed = QualifiedId.fromKey(key)

      expect(reconstructed.id).toBe(original.id)
      expect(reconstructed.domain).toBe(original.domain)
    })

    it('should allow using reconstructed QualifiedId as Map key', () => {
      const original = new QualifiedId('user-id', 'example.com')
      const map = new Map<string, string>()

      const key1 = QualifiedId.toKey(original)
      map.set(key1, 'value1')

      const key2 = QualifiedId.toKey(QualifiedId.fromKey(key1))

      expect(map.get(key2)).toBe('value1')
    })
  })
})

