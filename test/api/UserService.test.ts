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
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {UserService} from '../../src/api/UserService.js'
import {UserRepository} from '../../src/db/UserRepository.js'
import {UsersApiClient} from '../../src/api/UsersApiClient.js'
import type {QualifiedId} from '../../src/model/QualifiedId.js'
import type {UserEntity} from '../../src/db/model/UserEntity.js'

const USER_A: QualifiedId = {id: 'user-a', domain: 'wire.com'}
const USER_B: QualifiedId = {id: 'user-b', domain: 'wire.com'}

const USER_A_ENTITY: UserEntity = {user_id: 'user-a', user_domain: 'wire.com', name: 'Alice', handle: 'alice'}
const USER_B_ENTITY: UserEntity = {user_id: 'user-b', user_domain: 'wire.com', name: 'Bob', handle: null}

describe('UserService', () => {
  let userService: UserService
  let mockUserRepository: UserRepository
  let mockUsersApiClient: UsersApiClient

  beforeEach(() => {
    mockUserRepository = {
      findByIdAndDomain: vi.fn().mockReturnValue(null),
      save: vi.fn(),
      saveMany: vi.fn()
    } as any

    mockUsersApiClient = {
      listUsers: vi.fn().mockResolvedValue({found: [], failed: [], not_found: []})
    } as any

    userService = new UserService(mockUserRepository, mockUsersApiClient)

    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('getUser', () => {
    it('returns cached entity when present', () => {
      vi.mocked(mockUserRepository.findByIdAndDomain).mockReturnValue(USER_A_ENTITY)

      const result = userService.getUser(USER_A)

      expect(result).toEqual(USER_A_ENTITY)
      expect(mockUserRepository.findByIdAndDomain).toHaveBeenCalledWith(USER_A.id, USER_A.domain)
    })

    it('returns null when user is not cached', () => {
      vi.mocked(mockUserRepository.findByIdAndDomain).mockReturnValue(null)

      expect(userService.getUser(USER_A)).toBeNull()
    })
  })

  describe('cacheUsers', () => {
    it('calls listUsers only for IDs not already in the DB', async () => {
      // USER_A is already cached; USER_B is not
      vi.mocked(mockUserRepository.findByIdAndDomain).mockImplementation((id) =>
        id === USER_A.id ? USER_A_ENTITY : null
      )
      vi.mocked(mockUsersApiClient.listUsers).mockResolvedValue({
        found: [{ qualified_id: USER_B, name: 'Bob', handle: null }],
        failed: [],
        not_found: []
      } as any)

      await userService.cacheUsers([USER_A, USER_B])

      // Only USER_B should be fetched — USER_A was already in the DB
      expect(mockUsersApiClient.listUsers).toHaveBeenCalledWith([USER_B])
    })

    it('does not call listUsers when all users are already cached', async () => {
      vi.mocked(mockUserRepository.findByIdAndDomain).mockReturnValue(USER_A_ENTITY)

      await userService.cacheUsers([USER_A])

      expect(mockUsersApiClient.listUsers).not.toHaveBeenCalled()
    })

    it('persists found users to the repository', async () => {
      vi.mocked(mockUsersApiClient.listUsers).mockResolvedValue({
        found: [
          {qualified_id: USER_A, name: 'Alice', handle: 'alice'},
          {qualified_id: USER_B, name: 'Bob', handle: null}
        ],
        failed: [],
        not_found: []
      } as any)

      await userService.cacheUsers([USER_A, USER_B])

      expect(mockUserRepository.saveMany).toHaveBeenCalledWith([
        {user_id: USER_A.id, user_domain: USER_A.domain, name: 'Alice', handle: 'alice'},
        {user_id: USER_B.id, user_domain: USER_B.domain, name: 'Bob', handle: null}
      ])
    })

    it('logs a warning but does not throw when some IDs fail', async () => {
      vi.mocked(mockUsersApiClient.listUsers).mockResolvedValue({
        found: [{qualified_id: USER_A, name: 'Alice', handle: null}],
        failed: [USER_B],
        not_found: []
      } as any)

      // Should resolve without throwing
      await expect(userService.cacheUsers([USER_A, USER_B])).resolves.toBeUndefined()
      expect(mockUserRepository.saveMany).toHaveBeenCalledWith([
        {user_id: USER_A.id, user_domain: USER_A.domain, name: 'Alice', handle: null}
      ])
    })

    it('does nothing for an empty list', async () => {
      await userService.cacheUsers([])

      expect(mockUsersApiClient.listUsers).not.toHaveBeenCalled()
      expect(mockUserRepository.saveMany).not.toHaveBeenCalled()
    })
  })
})
