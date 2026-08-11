/*
 * Wire
 * Copyright (C) 2026 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 */

import {beforeEach, describe, expect, it, vi} from 'vitest'
import {NotificationsService} from '../../src/service/NotificationsService.js'
import {NotificationsApiClient} from '../../src/api/NotificationsApiClient.js'
import {AppProperties} from '../../src/service/AppProperties.js'
import type {EventResponse} from '../../src/api/response/EventResponse.js'

const NOTIFICATION_ID_1 = 'notification-id-1'

const makeNotification = (id: string): EventResponse => ({id, payload: []}) as unknown as EventResponse

let mockNotificationsApiClient: NotificationsApiClient
let mockAppProperties: AppProperties

beforeEach(() => {
  mockNotificationsApiClient = {
    getLastNotification: vi.fn(),
    getPaginatedNotifications: vi.fn()
  } as any

  mockAppProperties = {
    getLastNotificationId: vi.fn().mockReturnValue(null),
    setLastNotificationId: vi.fn()
  } as any

  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

const makeService = () => new NotificationsService(mockNotificationsApiClient, mockAppProperties)

describe('NotificationsService', () => {
  describe('getLastNotificationId', () => {
    it('should return cached id if available', async () => {
      vi.mocked(mockAppProperties.getLastNotificationId).mockReturnValue(NOTIFICATION_ID_1)

      const service = makeService()
      const result = await service.getLastNotificationId()

      expect(result).toBe(NOTIFICATION_ID_1)
      expect(mockNotificationsApiClient.getLastNotification).not.toHaveBeenCalled()
    })

    it('should fetch from API and cache if no cached id', async () => {
      vi.mocked(mockNotificationsApiClient.getLastNotification).mockResolvedValue(makeNotification(NOTIFICATION_ID_1))

      const service = makeService()
      const result = await service.getLastNotificationId()

      expect(result).toBe(NOTIFICATION_ID_1)
      expect(mockAppProperties.setLastNotificationId).toHaveBeenCalledWith(NOTIFICATION_ID_1)
    })
  })

  describe('getPaginatedNotifications', () => {
    it('should return notifications from API', async () => {
      const notifications = [makeNotification(NOTIFICATION_ID_1)]
      vi.mocked(mockNotificationsApiClient.getPaginatedNotifications).mockResolvedValue({
        notifications,
        has_more: false,
        time: new Date()
      })

      const service = makeService()
      const result = await service.getPaginatedNotifications()

      expect(result.notifications).toEqual(notifications)
      expect(result.has_more).toBe(false)
    })

    it('should pass querySince to the API client', async () => {
      vi.mocked(mockNotificationsApiClient.getPaginatedNotifications).mockResolvedValue({
        notifications: [],
        has_more: false,
        time: new Date()
      })

      const service = makeService()
      await service.getPaginatedNotifications(NOTIFICATION_ID_1)

      expect(mockNotificationsApiClient.getPaginatedNotifications).toHaveBeenCalledWith(100, NOTIFICATION_ID_1)
    })

    it('should return empty result if API throws', async () => {
      vi.mocked(mockNotificationsApiClient.getPaginatedNotifications).mockRejectedValue(new Error('API error'))

      const service = makeService()
      const result = await service.getPaginatedNotifications()

      expect(result.notifications).toEqual([])
      expect(result.has_more).toBe(false)
    })
  })
})
