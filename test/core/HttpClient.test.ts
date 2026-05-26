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

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../../src/core/HttpClient.js';
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { AppProperties } from "../../src/service/AppProperties.js";
import { container } from "tsyringe";

const TEST_API_HOST = 'https://test.api.host'
const TEST_ACCESS_TOKEN = 'test-access-token'
const COOKIE = 'test-cookie'
const NEW_COOKIE = 'new-test-cookie'

const createHttpClient = (appProperties: AppProperties) =>
  new HttpClient(TEST_API_HOST, appProperties)

export const restHandlers = [
  http.post(`${TEST_API_HOST}/v*/access`, ({ cookies }) => {
    if (cookies['zuid'] != COOKIE)
      return new HttpResponse(null, { status: 403 })
    return HttpResponse.json({
      access_token: TEST_ACCESS_TOKEN,
      expires_in: 900,
      token_type: 'Bearer',
      user: 'test-uuid'
    },
    {
     headers: {'set-cookie': `zuid=${NEW_COOKIE}; Path=/access; HttpOnly; Secure`}
    })
  })
]

const server = setupServer(...restHandlers)

describe('HttpClient', () => {
  let mockAppProperties: AppProperties
  let storedCookie: string | undefined

  beforeEach(() => {
    container.clearInstances()

    storedCookie = undefined

    mockAppProperties = {
      getBackendCookie: vi.fn(() => storedCookie),
      saveBackendCookie: vi.fn((cookie) => {
        storedCookie = cookie
      }),
    } as any
  })

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterAll(() => server.close())
  afterEach(() => server.resetHandlers())

  describe('Access token', () => {
    it('should be set after successful response to `/access` endpoint', async () => {
      // given
      vi.mocked(mockAppProperties.getBackendCookie).mockReturnValue(COOKIE)
      const httpClient = createHttpClient(mockAppProperties)

      // when
      await httpClient.verifyAuthorizationToken()

      // then
      expect(httpClient.getCachedAccessToken()).toEqual(TEST_ACCESS_TOKEN)
    });

    it('should be updated with client ID when it is registered', () => {
      // given cookie is set

      // when client is registered

      // then full-fledged cookie should be set
    })
  })
  describe('App token', () => {
    it('should be set in Cookie header in request to `/access` endpoint', async () => {
      const requestPromise = new Promise<Request>(resolve => {
        server.events.on('request:match', ({ request }) => resolve(request.clone()))
      })

      // given
      vi.mocked(mockAppProperties.getBackendCookie).mockReturnValue(COOKIE)
      const httpClient = createHttpClient(mockAppProperties)

      // when
      await httpClient.verifyAuthorizationToken()

      // then
      const capturedRequest = await requestPromise
      expect(capturedRequest.headers.get('Cookie')).toContain(`zuid=${COOKIE}`)
    });

    it('should be replaced when a new cookie is available', async () => {
      // given cookie is set
      vi.mocked(mockAppProperties.getBackendCookie).mockReturnValue(COOKIE)
      const httpClient = createHttpClient(mockAppProperties)

      // when new cookie comes in access cookie header
      await httpClient.verifyAuthorizationToken()

      // then it should replace the old one
      expect(storedCookie).toEqual(NEW_COOKIE)
    });

    it('should be deleted when expired', () => {
      // given cookie is set

      // when access endpoint is called and it fails

      // then cookie should be erased from storage
    });
  })
  describe('Query param `client_id`', () => {
    it('should be set when stored', () => {

    });

    it('should be omitted when not stored', () => {

    });
  })
})
