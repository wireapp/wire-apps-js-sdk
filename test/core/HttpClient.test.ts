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

import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('../../src/core/HttpRetryHelper.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/HttpRetryHelper.js')>()

  return {
    ...actual,
    calculateHttpRetryDelay: vi.fn(() => 0),
    waitForHttpRetry: vi.fn(async () => {})
  }
})

import {HttpClient} from '../../src/core/HttpClient.js'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import {AppProperties} from '../../src/service/AppProperties.js'
import {container} from 'tsyringe'
import {ClientsApiClient} from '../../src/api/ClientsApiClient.js'
import {PreKeyCrypto} from '../../src/model/PreKeyCrypto.js'
import {HTTP_RETRY_POLICY} from '../../src/core/HttpRetryPolicy.js'

const TEST_API_HOST = 'https://test.api.host'
const TEST_ACCESS_TOKEN = 'test-access-token'
const FULL_FLEDGED_ACCESS_TOKEN = 'test-access-token-with-client-id'
const COOKIE = 'test-cookie'
const NEW_COOKIE = 'new-test-cookie'

const createHttpClient = (appProperties: AppProperties) => new HttpClient(TEST_API_HOST, appProperties)

export const restHandlers = [
  http.post(`${TEST_API_HOST}/v*/access`, ({request, cookies}) => {
    if (cookies['zuid'] != COOKIE)
      return HttpResponse.json(
        {
          code: 403,
          label: 'invalid-credentials',
          message: 'Authentication failed'
        },
        {
          status: 403
        }
      )
    const url = new URL(request.url)
    const clientId = url.searchParams.get('client_id')
    const accessToken = clientId ? FULL_FLEDGED_ACCESS_TOKEN : TEST_ACCESS_TOKEN

    return HttpResponse.json(
      {
        access_token: accessToken,
        expires_in: 900,
        token_type: 'Bearer',
        user: 'test-uuid'
      },
      {
        headers: {'set-cookie': `zuid=${NEW_COOKIE}; Path=/access; HttpOnly; Secure`}
      }
    )
  }),
  http.post(`${TEST_API_HOST}/v*/clients`, () => {
    return HttpResponse.json({id: 'test-client-id'})
  })
]

const server = setupServer(...restHandlers)

describe('HttpClient', () => {
  let mockAppProperties: AppProperties
  let storedCookie: string | undefined
  let storedDeviceId: string | undefined

  beforeEach(() => {
    container.clearInstances()

    storedCookie = undefined
    storedDeviceId = undefined

    mockAppProperties = {
      getBackendCookie: vi.fn(() => storedCookie),
      saveBackendCookie: vi.fn((cookie) => {
        storedCookie = cookie
      }),
      deleteBackendCookie: vi.fn(),
      getDeviceId: vi.fn(() => {
        if (!storedDeviceId) {
          throw new Error('No stored deviceId found')
        }
        return storedDeviceId
      }),
      hasDeviceId: vi.fn(() => !!storedDeviceId)
    } as any
  })

  beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
  afterAll(() => server.close())
  afterEach(() => server.resetHandlers())

  describe('Access token', () => {
    it('should be set after successful response to `/access` endpoint', async () => {
      // given
      vi.mocked(mockAppProperties.getBackendCookie).mockReturnValue(COOKIE)
      const httpClient = createHttpClient(mockAppProperties)

      // when
      await httpClient.refreshAccessToken()

      // then
      expect(httpClient.getCachedAccessToken()).toEqual(TEST_ACCESS_TOKEN)
    })

    it('should be updated with client ID when it is registered', async () => {
      // given
      vi.mocked(mockAppProperties.getBackendCookie).mockReturnValue(COOKIE)
      const httpClient = createHttpClient(mockAppProperties)

      // when
      const clientsApiClient = new ClientsApiClient(httpClient, mockAppProperties)
      const testPreKeys: PreKeyCrypto[] = [new PreKeyCrypto(1, 'foo')]
      storedDeviceId = await clientsApiClient.registerClient(testPreKeys, testPreKeys[0]!)

      await httpClient.refreshAccessToken()

      // then
      expect(httpClient.getCachedAccessToken()).toEqual(FULL_FLEDGED_ACCESS_TOKEN)
    })

    describe('on expiry', () => {
      const TEST_AUTHORIZED_ENDPOINT = 'test-endpoint'
      const ALWAYS_RETURNS_UNAUTHORIZED_ENDPOINT = 'always-unauthorized'
      const html = `
        <html>
        <head><title>401 Authorization Required</title></head>
        <body>
        <center><h1>401 Authorization Required</h1></center>
        <hr><center>nginx</center>
        </body>
        </html>
      `
      let tokenRefreshCount: number
      let requestCount: number

      beforeEach(() => {
        tokenRefreshCount = 0
        requestCount = 0

        server.use(
          http.post(`${TEST_API_HOST}/v*/access`, () => {
            tokenRefreshCount++
            return HttpResponse.json({access_token: TEST_ACCESS_TOKEN})
          }),
          http.get(`${TEST_API_HOST}/v*/${TEST_AUTHORIZED_ENDPOINT}`, ({request}) => {
            const accessToken = request.headers.get('Authorization')
            requestCount++

            if (!accessToken) {
              return HttpResponse.html(html, {status: 401})
            }
            return HttpResponse.json({data: 'example'}, {status: 200})
          }),
          http.get(`${TEST_API_HOST}/v*/${ALWAYS_RETURNS_UNAUTHORIZED_ENDPOINT}`, () => {
            requestCount++
            return HttpResponse.html(html, {status: 401})
          })
        )
      })

      it('should be refreshed', async () => {
        // given
        const httpClient = createHttpClient(mockAppProperties)

        // when
        await httpClient.getRequest(TEST_AUTHORIZED_ENDPOINT)

        // then
        expect(tokenRefreshCount).toBe(1)
      })

      it('should retry the original request', async () => {
        // given
        const httpClient = createHttpClient(mockAppProperties)

        // when
        const response = await httpClient.request(TEST_AUTHORIZED_ENDPOINT, {method: 'GET'})

        // then
        expect(requestCount).toBe(2)
        expect(response.response.status).toBe(200)
      })

      it('should not retry a request more than once', async () => {
        // given
        const httpClient = createHttpClient(mockAppProperties)

        // when
        await expect(httpClient.getRequest(ALWAYS_RETURNS_UNAUTHORIZED_ENDPOINT)).rejects.toThrow()

        // then
        expect(requestCount).toBe(2)
      })

      it('should not refresh on the next request', async () => {
        // given
        const httpClient = createHttpClient(mockAppProperties)
        await httpClient.getRequest(TEST_AUTHORIZED_ENDPOINT)

        // when
        await httpClient.getRequest(TEST_AUTHORIZED_ENDPOINT)

        // then
        expect(tokenRefreshCount).toBe(1)
      })

      it('should refresh once on concurrent unauthorized request', async () => {
        // given
        const httpClient = createHttpClient(mockAppProperties)

        // when
        await Promise.all([
          httpClient.getRequest(TEST_AUTHORIZED_ENDPOINT),
          httpClient.getRequest(TEST_AUTHORIZED_ENDPOINT)
        ])

        // then
        expect(tokenRefreshCount).toBe(1)
      })
    })

    describe('with default retry policy', () => {
      it('should retry a retryable HTTP status and return the successful response', async () => {
        // given
        const TEST_TRANSIENT_ENDPOINT = 'transient-endpoint'
        let requestCount = 0
        server.use(
          http.get(`${TEST_API_HOST}/v*/${TEST_TRANSIENT_ENDPOINT}`, () => {
            requestCount++
            if (requestCount === 1) {
              return HttpResponse.text('temporary failure', {status: 503})
            }

            return HttpResponse.json({data: 'example'}, {status: 200})
          })
        )
        const httpClient = createHttpClient(mockAppProperties)

        // when
        const response = await httpClient.getRequest<{data: string}>(TEST_TRANSIENT_ENDPOINT)

        // then
        expect(requestCount).toBe(2)
        expect(response).toEqual({data: 'example'})
      })

      it('should retry a network failure and return the successful response', async () => {
        // given
        const TEST_NETWORK_ENDPOINT = 'network-failure-then-success'
        let requestCount = 0
        server.use(
          http.get(`${TEST_API_HOST}/v*/${TEST_NETWORK_ENDPOINT}`, () => {
            requestCount++
            if (requestCount === 1) {
              return HttpResponse.error()
            }

            return HttpResponse.json({data: 'example'}, {status: 200})
          })
        )
        const httpClient = createHttpClient(mockAppProperties)

        // when
        const response = await httpClient.getRequest<{data: string}>(TEST_NETWORK_ENDPOINT)

        // then
        expect(requestCount).toBe(2)
        expect(response).toEqual({data: 'example'})
      })

      it('should retry a retryable HTTP status by default', async () => {
        // given
        const TEST_TRANSIENT_ENDPOINT = 'transient-by-default'
        let requestCount = 0
        server.use(
          http.get(`${TEST_API_HOST}/v*/${TEST_TRANSIENT_ENDPOINT}`, () => {
            requestCount++
            if (requestCount === 1) {
              return HttpResponse.text('temporary failure', {status: 503})
            }

            return HttpResponse.json({data: 'example'}, {status: 200})
          })
        )
        const httpClient = createHttpClient(mockAppProperties)

        // when
        const response = await httpClient.getRequest<{data: string}>(TEST_TRANSIENT_ENDPOINT)

        // then
        expect(requestCount).toBe(2)
        expect(response).toEqual({data: 'example'})
      })

      it('should exhaust default retry attempts for retryable HTTP status', async () => {
        // given
        const TEST_TRANSIENT_ENDPOINT = 'transient-default-exhausted'
        let requestCount = 0
        server.use(
          http.get(`${TEST_API_HOST}/v*/${TEST_TRANSIENT_ENDPOINT}`, () => {
            requestCount++
            return HttpResponse.text('temporary failure', {status: 503})
          })
        )
        const httpClient = createHttpClient(mockAppProperties)

        // when & then
        await expect(httpClient.getRequest(TEST_TRANSIENT_ENDPOINT)).rejects.toThrow(
          'HTTP 503 for transient-default-exhausted'
        )
        expect(requestCount).toBe(HTTP_RETRY_POLICY.maxAttempts)
      })

      it('should not retry a non-retryable HTTP status', async () => {
        // given
        const TEST_BAD_REQUEST_ENDPOINT = 'bad-request'
        let requestCount = 0
        server.use(
          http.get(`${TEST_API_HOST}/v*/${TEST_BAD_REQUEST_ENDPOINT}`, () => {
            requestCount++
            return HttpResponse.text('bad request', {status: 400})
          })
        )
        const httpClient = createHttpClient(mockAppProperties)

        // when & then
        await expect(httpClient.getRequest(TEST_BAD_REQUEST_ENDPOINT)).rejects.toThrow('HTTP 400 for bad-request')
        expect(requestCount).toBe(1)
      })

      it('should preserve final error handling after retry attempts are exhausted', async () => {
        // given
        const TEST_ALWAYS_TRANSIENT_ENDPOINT = 'always-transient'
        let requestCount = 0
        server.use(
          http.get(`${TEST_API_HOST}/v*/${TEST_ALWAYS_TRANSIENT_ENDPOINT}`, () => {
            requestCount++
            return HttpResponse.text('temporary failure', {status: 503})
          })
        )
        const httpClient = createHttpClient(mockAppProperties)

        // when & then
        await expect(httpClient.getRequest(TEST_ALWAYS_TRANSIENT_ENDPOINT)).rejects.toThrow(
          'HTTP 503 for always-transient'
        )
        expect(requestCount).toBe(HTTP_RETRY_POLICY.maxAttempts)
      })

      it('should retry access token refresh and cache token on success', async () => {
        // given
        vi.mocked(mockAppProperties.getBackendCookie).mockReturnValue(COOKIE)
        let tokenRefreshCount = 0
        server.use(
          http.post(`${TEST_API_HOST}/v*/access`, () => {
            tokenRefreshCount++
            if (tokenRefreshCount === 1) {
              return HttpResponse.text('temporary failure', {status: 503})
            }

            return HttpResponse.json({access_token: TEST_ACCESS_TOKEN})
          })
        )
        const httpClient = createHttpClient(mockAppProperties)

        // when
        await httpClient.refreshAccessToken()

        // then
        expect(tokenRefreshCount).toBe(2)
        expect(httpClient.getCachedAccessToken()).toEqual(TEST_ACCESS_TOKEN)
      })

      it('should reject access token refresh after default retry attempts are exhausted', async () => {
        // given
        vi.mocked(mockAppProperties.getBackendCookie).mockReturnValue(COOKIE)
        let tokenRefreshCount = 0
        server.use(
          http.post(`${TEST_API_HOST}/v*/access`, () => {
            tokenRefreshCount++
            return HttpResponse.text('temporary failure', {status: 503})
          })
        )
        const httpClient = createHttpClient(mockAppProperties)

        // when & then
        await expect(httpClient.refreshAccessToken()).rejects.toThrow('HTTP 503 for access')
        expect(tokenRefreshCount).toBe(HTTP_RETRY_POLICY.maxAttempts)
      })

      it('should not retry invalid credentials and should delete the backend cookie', async () => {
        // given
        storedCookie = 'test-expired-cookie'
        let tokenRefreshCount = 0
        server.use(
          http.post(`${TEST_API_HOST}/v*/access`, () => {
            tokenRefreshCount++
            return HttpResponse.json(
              {
                code: 403,
                label: 'invalid-credentials',
                message: 'Authentication failed'
              },
              {
                status: 403
              }
            )
          })
        )
        const httpClient = createHttpClient(mockAppProperties)

        // when & then
        await expect(httpClient.refreshAccessToken()).rejects.toThrow(
          'Current cookie/api-token is expired. Get a new apiToken and restart the App'
        )
        expect(tokenRefreshCount).toBe(1)
        expect(mockAppProperties.deleteBackendCookie).toHaveBeenCalled()
      })

      it('should share one retry sequence for concurrent access token refreshes', async () => {
        // given
        vi.mocked(mockAppProperties.getBackendCookie).mockReturnValue(COOKIE)
        let tokenRefreshCount = 0
        server.use(
          http.post(`${TEST_API_HOST}/v*/access`, () => {
            tokenRefreshCount++
            if (tokenRefreshCount === 1) {
              return HttpResponse.text('temporary failure', {status: 503})
            }

            return HttpResponse.json({access_token: TEST_ACCESS_TOKEN})
          })
        )
        const httpClient = createHttpClient(mockAppProperties)

        // when
        await Promise.all([httpClient.refreshAccessToken(), httpClient.refreshAccessToken()])

        // then
        expect(tokenRefreshCount).toBe(2)
        expect(httpClient.getCachedAccessToken()).toEqual(TEST_ACCESS_TOKEN)
      })
    })
  })
  describe('App token', () => {
    it('should be set in Cookie header in request to `/access` endpoint', async () => {
      const requestPromise = new Promise<Request>((resolve) => {
        server.events.on('request:match', ({request}) => resolve(request.clone()))
      })

      // given
      vi.mocked(mockAppProperties.getBackendCookie).mockReturnValue(COOKIE)
      const httpClient = createHttpClient(mockAppProperties)

      // when
      await httpClient.refreshAccessToken()

      // then
      const capturedRequest = await requestPromise
      expect(capturedRequest.headers.get('Cookie')).toContain(`zuid=${COOKIE}`)
    })

    it('should be replaced when a new cookie is available', async () => {
      // given
      vi.mocked(mockAppProperties.getBackendCookie).mockReturnValue(COOKIE)
      const httpClient = createHttpClient(mockAppProperties)

      // when
      await httpClient.refreshAccessToken()

      // then
      expect(storedCookie).toEqual(NEW_COOKIE)
    })

    it('should be deleted when expired', async () => {
      // given cookie is set
      storedCookie = 'test-expired-cookie'
      const httpClient = createHttpClient(mockAppProperties)

      // when & then
      await expect(httpClient.refreshAccessToken()).rejects.toThrow()
      expect(mockAppProperties.deleteBackendCookie).toHaveBeenCalled()
    })
  })
})
