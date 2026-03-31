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

import {beforeEach, describe, expect, it, vi} from 'vitest'
import {WebSocketClient} from '../../src/core/WebSocketClient.js'
import {HttpClient} from '../../src/core/HttpClient.js'
import {EventRouter} from '../../src/core/event/EventRouter.js'
import {NotificationsService} from '../../src/service/NotificationsService.js'
import {AppProperties} from '../../src/service/AppProperties.js'
import type {EventResponse} from '../../src/api/response/EventResponse.js'

vi.mock('ws', () => {
  const MockWebSocket = vi.fn(function (this: typeof mockWebSocket) {
    this.onopen = null
    this.onmessage = null
    this.onerror = null
    this.onclose = null
    this.close = vi.fn()
    this.readyState = 1
    mockWebSocket = this as any
  })
  return {WebSocket: MockWebSocket}
})

const makeEventBuffer = (event: Partial<EventResponse>): Buffer =>
  Buffer.from(JSON.stringify(event), 'utf-8')

const makeMessageEvent = (data: Buffer): MessageEvent =>
  ({data}) as MessageEvent

const NOTIFICATION_ID_1 = 'notification-id-1'
const NOTIFICATION_ID_2 = 'notification-id-2'

const makeNotification = (id: string, transient = false): EventResponse =>
  ({id, transient, payload: []}) as unknown as EventResponse

let mockHttpClient: HttpClient
let mockEventRouter: EventRouter
let mockNotificationsService: NotificationsService
let mockAppProperties: AppProperties
let mockWebSocket: {
  onopen: (() => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((error: Event) => void) | null
  onclose: (() => void) | null
  close: ReturnType<typeof vi.fn>
  readyState: number
}

beforeEach(() => {
  vi.clearAllMocks()
  delete (globalThis as any).WebSocket

  mockHttpClient = {
    getCachedDeviceId: vi.fn().mockReturnValue('device-id'),
    getCachedAccessToken: vi.fn().mockReturnValue('access-token'),
  } as any

  mockEventRouter = {
    route: vi.fn().mockResolvedValue(undefined),
  } as any

  mockNotificationsService = {
    getLastNotificationId: vi.fn().mockResolvedValue(null),
    getPaginatedNotifications: vi.fn().mockResolvedValue({
      notifications: [],
      has_more: false,
    }),
  } as any

  mockAppProperties = {
    setLastNotificationId: vi.fn(),
  } as any

  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const makeClient = () =>
  new WebSocketClient(
    "https://wire.com",
    mockHttpClient,
    mockNotificationsService,
    mockAppProperties,
    mockEventRouter
  )

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('WebSocketClient', () => {
  describe('syncMissedNotifications', () => {
    it('should route all notifications from a single page', async () => {
      const notifications = [
        makeNotification(NOTIFICATION_ID_1),
        makeNotification(NOTIFICATION_ID_2),
      ]

      vi.mocked(mockNotificationsService.getPaginatedNotifications).mockResolvedValueOnce({
        has_more: false,
        notifications: notifications,
        time: new Date()
      })

      const client = makeClient()
      const connectPromise = client.connect()

      await flushPromises()
      await mockWebSocket.onopen!()
      mockWebSocket.onclose!()
      await connectPromise

      expect(mockEventRouter.route).toHaveBeenCalledTimes(2)
      expect(mockEventRouter.route).toHaveBeenCalledWith(notifications[0])
      expect(mockEventRouter.route).toHaveBeenCalledWith(notifications[1])
    })

    it('should paginate until has_more is false', async () => {
      const page1 = [makeNotification(NOTIFICATION_ID_1)]
      const page2 = [makeNotification(NOTIFICATION_ID_2)]

      vi.mocked(mockNotificationsService.getPaginatedNotifications)
        .mockResolvedValueOnce({notifications: page1, has_more: true, time: new Date()})
        .mockResolvedValueOnce({notifications: page2, has_more: false, time: new Date()})

      const client = makeClient()
      const connectPromise = client.connect()

      await flushPromises()
      await mockWebSocket.onopen!()
      mockWebSocket.onclose!()
      await connectPromise

      expect(mockNotificationsService.getPaginatedNotifications).toHaveBeenCalledTimes(2)
      expect(mockEventRouter.route).toHaveBeenCalledTimes(2)
    })

    it('should update lastNotificationId after each page', async () => {
      const page1 = [makeNotification(NOTIFICATION_ID_1)]
      const page2 = [makeNotification(NOTIFICATION_ID_2)]

      vi.mocked(mockNotificationsService.getPaginatedNotifications)
        .mockResolvedValueOnce({notifications: page1, has_more: true, time: new Date()})
        .mockResolvedValueOnce({notifications: page2, has_more: false, time: new Date()})

      const client = makeClient()
      const connectPromise = client.connect()

      await flushPromises()
      await mockWebSocket.onopen!()
      mockWebSocket.onclose!()
      await connectPromise

      expect(mockAppProperties.setLastNotificationId).toHaveBeenCalledWith(NOTIFICATION_ID_1)
      expect(mockAppProperties.setLastNotificationId).toHaveBeenCalledWith(NOTIFICATION_ID_2)
    })

    it('should pass lastNotificationId from AppProperties into first paginated request', async () => {
      const LAST_KNOWN_ID = 'last-known-notification-id'
      vi.mocked(mockNotificationsService.getLastNotificationId).mockResolvedValue(LAST_KNOWN_ID)

      vi.mocked(mockNotificationsService.getPaginatedNotifications).mockResolvedValueOnce({
        notifications: [],
        has_more: false,
        time: new Date()
      })

      const client = makeClient()
      const connectPromise = client.connect()

      await flushPromises()
      await mockWebSocket.onopen!()
      mockWebSocket.onclose!()
      await connectPromise

      expect(mockNotificationsService.getPaginatedNotifications).toHaveBeenCalledWith(LAST_KNOWN_ID)
    })

    it('should continue processing other notifications if one fails to route', async () => {
      const notifications = [
        makeNotification(NOTIFICATION_ID_1),
        makeNotification(NOTIFICATION_ID_2),
      ]

      vi.mocked(mockNotificationsService.getPaginatedNotifications).mockResolvedValueOnce({
        notifications,
        has_more: false,
        time: new Date()
      })

      vi.mocked(mockEventRouter.route)
        .mockRejectedValueOnce(new Error('routing failed'))
        .mockResolvedValueOnce(undefined)

      const client = makeClient()
      const connectPromise = client.connect()

      await flushPromises()
      await mockWebSocket.onopen!()
      mockWebSocket.onclose!()
      await connectPromise

      expect(mockEventRouter.route).toHaveBeenCalledTimes(2)
    })
  })

  describe('handleEvent', () => {
    it('should route a valid non-transient event', async () => {
      const event = makeNotification(NOTIFICATION_ID_1)

      const client = makeClient()
      const connectPromise = client.connect()

      await flushPromises()
      await mockWebSocket.onopen!()
      await mockWebSocket.onmessage!(makeMessageEvent(makeEventBuffer(event)))
      mockWebSocket.onclose!()
      await connectPromise

      expect(mockEventRouter.route).toHaveBeenCalledWith(expect.objectContaining({id: NOTIFICATION_ID_1}))
    })

    it('should skip transient events', async () => {
      const event = makeNotification(NOTIFICATION_ID_1, true)

      const client = makeClient()
      const connectPromise = client.connect()

      await flushPromises()
      await mockWebSocket.onopen!()
      await mockWebSocket.onmessage!(makeMessageEvent(makeEventBuffer(event)))
      mockWebSocket.onclose!()
      await connectPromise

      expect(mockEventRouter.route).not.toHaveBeenCalled()
    })

    it('should deduplicate events already processed during sync', async () => {
      const notification = makeNotification(NOTIFICATION_ID_1)

      vi.mocked(mockNotificationsService.getPaginatedNotifications).mockResolvedValueOnce({
        notifications: [notification],
        has_more: false,
        time: new Date()
      })

      const client = makeClient()
      const connectPromise = client.connect()

      await flushPromises()
      await mockWebSocket.onopen!()

      await mockWebSocket.onmessage!(makeMessageEvent(makeEventBuffer(notification)))

      mockWebSocket.onclose!()
      await connectPromise

      expect(mockEventRouter.route).toHaveBeenCalledTimes(1)
    })

    it('should update lastNotificationId after routing a live event', async () => {
      const event = makeNotification(NOTIFICATION_ID_1)

      const client = makeClient()
      const connectPromise = client.connect()

      await flushPromises()
      await mockWebSocket.onopen!()
      await mockWebSocket.onmessage!(makeMessageEvent(makeEventBuffer(event)))
      mockWebSocket.onclose!()
      await connectPromise

      expect(mockAppProperties.setLastNotificationId).toHaveBeenCalledWith(NOTIFICATION_ID_1)
    })
  })

  describe('message buffering during sync', () => {
    it('should buffer messages received during sync and process them after', async () => {
      let resolveSync!: () => void
      const syncPromise = new Promise<void>((res) => (resolveSync = res))

      vi.mocked(mockNotificationsService.getPaginatedNotifications).mockReturnValueOnce(
        syncPromise.then(() => ({notifications: [], has_more: false, time: new Date()}))
      )

      const event = makeNotification(NOTIFICATION_ID_1)

      const client = makeClient()
      const connectPromise = client.connect()

      await flushPromises()
      const openPromise = mockWebSocket.onopen!()

      await mockWebSocket.onmessage!(makeMessageEvent(makeEventBuffer(event)))

      expect(mockEventRouter.route).not.toHaveBeenCalled()

      resolveSync()
      await openPromise

      expect(mockEventRouter.route).toHaveBeenCalledTimes(1)
      expect(mockEventRouter.route).toHaveBeenCalledWith(expect.objectContaining({id: NOTIFICATION_ID_1}))

      mockWebSocket.onclose!()
      await connectPromise
    })
  })

  describe('close', () => {
    it('should close the websocket when connected', () => {
      const client = makeClient()
      client.connect()
      client.close()

      expect(mockWebSocket.close).toHaveBeenCalled()
    })

    it('should do nothing if websocket is not initialized', () => {
      const client = makeClient()
      expect(() => client.close()).not.toThrow()
    })
  })
})
