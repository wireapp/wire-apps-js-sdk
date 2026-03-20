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

import 'reflect-metadata'
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'
import {UserRepository} from '../../src/db/UserRepository.js'
import {TestDatabaseService} from '../helpers/TestDatabaseService.js'
import type {UserEntity} from '../../src/db/model/UserEntity.js'

describe('UserRepository', () => {
  let testDbService: TestDatabaseService
  let userRepository: UserRepository

  beforeAll(() => {
    testDbService = new TestDatabaseService()
  })

  afterAll(() => {
    testDbService.close()
  })

  beforeEach(() => {
    testDbService.clearData()
    userRepository = new UserRepository(testDbService)
  })

  it('returns null for an unknown user', () => {
    expect(userRepository.findByIdAndDomain('unknown', 'wire.com')).toBeNull()
  })

  it('saves and retrieves a user', () => {
    const user: UserEntity = {user_id: 'abc', user_domain: 'wire.com', name: 'Alice', handle: 'alice'}

    userRepository.save(user)

    expect(userRepository.findByIdAndDomain('abc', 'wire.com')).toEqual(user)
  })

  it('upserts on conflict — updates name and handle without duplicating the row', () => {
    const original: UserEntity = {user_id: 'abc', user_domain: 'wire.com', name: 'Alice', handle: 'alice'}
    const updated: UserEntity = {user_id: 'abc', user_domain: 'wire.com', name: 'Alice Updated', handle: 'alice2'}

    userRepository.save(original)
    userRepository.save(updated)

    const result = userRepository.findByIdAndDomain('abc', 'wire.com')
    expect(result?.name).toBe('Alice Updated')
    expect(result?.handle).toBe('alice2')
  })

  it('saves multiple users in a single transaction via saveMany', () => {
    const users: UserEntity[] = [
      {user_id: 'u1', user_domain: 'wire.com', name: 'User One', handle: null},
      {user_id: 'u2', user_domain: 'wire.com', name: 'User Two', handle: 'usertwo'}
    ]

    userRepository.saveMany(users)

    expect(userRepository.findByIdAndDomain('u1', 'wire.com')?.name).toBe('User One')
    expect(userRepository.findByIdAndDomain('u2', 'wire.com')?.name).toBe('User Two')
  })

  it('treats the same user id on different domains as distinct rows', () => {
    const domainA: UserEntity = {user_id: 'shared-id', user_domain: 'alpha.com', name: 'Alpha User', handle: null}
    const domainB: UserEntity = {user_id: 'shared-id', user_domain: 'beta.com', name: 'Beta User', handle: null}

    userRepository.saveMany([domainA, domainB])

    expect(userRepository.findByIdAndDomain('shared-id', 'alpha.com')?.name).toBe('Alpha User')
    expect(userRepository.findByIdAndDomain('shared-id', 'beta.com')?.name).toBe('Beta User')
  })
})
