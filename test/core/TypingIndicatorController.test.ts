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

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {TypingIndicatorController} from '../../src/core/TypingIndicatorController.js'
import {QualifiedId} from '../../src/model/QualifiedId.js'
import {TypingStatus} from '../../src/model/conversation/TypingStatus.js'

describe('TypingIndicatorController', () => {
  const id = new QualifiedId('conversation', 'example.com')
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('shares refreshes and stops only after the last overlapping scope', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const controller = new TypingIndicatorController(send)
    const first = controller.acquire(id)
    const second = controller.acquire(new QualifiedId(id.id, id.domain))
    await vi.advanceTimersByTimeAsync(30_000)
    first()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(send.mock.calls.map(([, status]) => status)).toEqual(Array(3).fill(TypingStatus.STARTED))
    second()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(send.mock.calls.map(([, status]) => status)).toEqual([
      TypingStatus.STARTED,
      TypingStatus.STARTED,
      TypingStatus.STARTED,
      TypingStatus.STOPPED
    ])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('orders a new scope after pending cleanup from the previous scope', async () => {
    let finishStart!: () => void
    const send = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finishStart = resolve)))
      .mockResolvedValue(undefined)
    const controller = new TypingIndicatorController(send)
    const first = controller.acquire(id)
    await vi.advanceTimersByTimeAsync(0)
    first()
    const second = controller.acquire(id)
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledTimes(1)
    finishStart()
    await vi.advanceTimersByTimeAsync(0)
    expect(send.mock.calls.map(([, status]) => status)).toEqual([
      TypingStatus.STARTED,
      TypingStatus.STOPPED,
      TypingStatus.STARTED
    ])
    second()
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenLastCalledWith(id, TypingStatus.STOPPED)
  })

  it('ends typing after five minutes without ending work or restarting on overlap', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const controller = new TypingIndicatorController(send)
    const release = controller.acquire(id)
    await vi.advanceTimersByTimeAsync(300_000)
    expect(send).toHaveBeenLastCalledWith(id, TypingStatus.STOPPED)
    const count = send.mock.calls.length
    const overlap = controller.acquire(id)
    await vi.advanceTimersByTimeAsync(300_000)
    expect(send).toHaveBeenCalledTimes(count)
    overlap()
    release()
    await vi.advanceTimersByTimeAsync(0)
    const next = controller.acquire(id)
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenLastCalledWith(id, TypingStatus.STARTED)
    next()
    await vi.advanceTimersByTimeAsync(0)
  })
})
