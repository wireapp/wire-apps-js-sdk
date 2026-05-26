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
import { ClientsApiClient } from "../../src/api/ClientsApiClient.js";
import { PreKeyCrypto } from "../../src/model/PreKeyCrypto.js";

const TEST_API_HOST = 'https://test.api.host'
const TEST_ACCESS_TOKEN = 'test-access-token'
const FULL_FLEDGED_ACCESS_TOKEN = 'test-access-token-with-client-id'
const COOKIE = 'test-cookie'
const NEW_COOKIE = 'new-test-cookie'

const createHttpClient = (appProperties: AppProperties) =>
  new HttpClient(TEST_API_HOST, appProperties)

export const restHandlers = [
  http.post(`${TEST_API_HOST}/v*/access`, ({ request, cookies }) => {
    if (cookies['zuid'] != COOKIE)
      return new HttpResponse(null, { status: 403 })
    const url = new URL(request.url)
    const clientId = url.searchParams.get('client_id')
    const accessToken = clientId ? FULL_FLEDGED_ACCESS_TOKEN : TEST_ACCESS_TOKEN

    return HttpResponse.json({
      access_token: accessToken,
      expires_in: 900,
      token_type: 'Bearer',
      user: 'test-uuid'
    },
    {
     headers: {'set-cookie': `zuid=${NEW_COOKIE}; Path=/access; HttpOnly; Secure`}
    })
  }),
  http.post(`${TEST_API_HOST}/v*/clients`, () => {
    return HttpResponse.json({id: 'test-client-id'})
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
      deleteBackendCookie: vi.fn()
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

    it('should be updated with client ID when it is registered', async () => {
      // given
      vi.mocked(mockAppProperties.getBackendCookie).mockReturnValue(COOKIE)
      const httpClient = createHttpClient(mockAppProperties)

      // when
      const clientsApiClient = new ClientsApiClient(httpClient)
      const testPreKeys: PreKeyCrypto[] = [new PreKeyCrypto(1, 'foo')]
      await clientsApiClient.registerClient(testPreKeys, testPreKeys[0]!)

      await httpClient.verifyAuthorizationToken()

      // then
      expect(httpClient.getCachedAccessToken()).toEqual(FULL_FLEDGED_ACCESS_TOKEN)
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
      // given
      vi.mocked(mockAppProperties.getBackendCookie).mockReturnValue(COOKIE)
      const httpClient = createHttpClient(mockAppProperties)

      // when
      await httpClient.verifyAuthorizationToken()

      // then
      expect(storedCookie).toEqual(NEW_COOKIE)
    });

    it('should be deleted when expired', async () => {
      // given cookie is set
      storedCookie = 'test-expired-cookie'
      const httpClient = createHttpClient(mockAppProperties)

      // when & then
      await expect(httpClient.verifyAuthorizationToken()).rejects.toThrow()
      expect(mockAppProperties.deleteBackendCookie).toHaveBeenCalled()
    })
  })
})
