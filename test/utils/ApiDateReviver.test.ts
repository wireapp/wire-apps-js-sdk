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
import {apiDateReviver} from '../../src/utils/ApiDateReviver.js'

const timestamp = '2026-09-28T12:34:56.789+02:00'

describe('apiDateReviver', () => {
  it('converts time fields recursively in nested objects and arrays', () => {
    const result = JSON.parse(
      JSON.stringify({
        time: timestamp,
        notifications: [{payload: [{time: timestamp, data: {users: [{id: 'user-id'}]}}]}]
      }),
      apiDateReviver
    )

    expect(result.time.toISOString()).toBe('2026-09-28T10:34:56.789Z')
    expect(result.notifications[0].payload[0].time.getTime()).toBe(Date.parse(timestamp))
    expect(result.notifications[0].payload[0].data).toEqual({users: [{id: 'user-id'}]})
  })

  it('preserves other fields, date-like strings, and events without time', () => {
    const response = {
      id: timestamp,
      transient: false,
      payload: [{type: 'conversation.typing'}],
      data: {text: timestamp, count: 3, value: null},
      empty: []
    }
    expect(JSON.parse(JSON.stringify(response), apiDateReviver)).toEqual(response)
  })

  it.each(['not-a-date', ''])('preserves unparseable time strings: %s', (time) => {
    const response = {time, payload: [{time}, {time: timestamp}]}
    expect(JSON.parse(JSON.stringify(response), apiDateReviver)).toEqual({
      time,
      payload: [{time}, {time: new Date(timestamp)}]
    })
  })

  it.each([null, 123, {}, []])('rejects non-string time fields: %s', (time) => {
    expect(() => JSON.parse(JSON.stringify({payload: [{time}]}), apiDateReviver)).toThrow(TypeError)
  })
})
