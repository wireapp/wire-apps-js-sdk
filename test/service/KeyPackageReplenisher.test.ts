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
import {KeyPackageReplenisher} from '../../src/service/KeyPackageReplenisher.js'
import type {CoreCryptoService} from '../../src/core/CoreCryptoService.js'
import type {MlsService} from '../../src/api/MlsService.js'

const DAY_MS = 24 * 60 * 60 * 1_000
const keyPackages = [new Uint8Array([1])]

describe('KeyPackageReplenisher', () => {
  let coreCryptoService: CoreCryptoService
  let mlsService: MlsService
  let replenisher: KeyPackageReplenisher

  beforeEach(() => {
    vi.useFakeTimers()
    coreCryptoService = {
      getDefaultCiphersuiteCode: vi.fn().mockReturnValue(1),
      mlsGenerateKeyPackages: vi.fn().mockResolvedValue(keyPackages)
    } as any
    mlsService = {
      getAvailableKeyPackageCount: vi.fn().mockResolvedValue(100),
      uploadMlsKeyPackages: vi.fn().mockResolvedValue(undefined)
    } as any
    replenisher = new KeyPackageReplenisher(mlsService, coreCryptoService)
  })

  afterEach(() => {
    replenisher.stop()
    vi.useRealTimers()
  })

  it('should replenish immediately when the backend count is below the threshold', async () => {
    vi.mocked(mlsService.getAvailableKeyPackageCount).mockResolvedValue(49)

    replenisher.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(mlsService.getAvailableKeyPackageCount).toHaveBeenCalledWith(1)
    expect(coreCryptoService.mlsGenerateKeyPackages).toHaveBeenCalledOnce()
    expect(mlsService.uploadMlsKeyPackages).toHaveBeenCalledWith(keyPackages)
  })

  it('should not replenish when the backend count is at the threshold', async () => {
    vi.mocked(mlsService.getAvailableKeyPackageCount).mockResolvedValue(50)

    replenisher.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(coreCryptoService.mlsGenerateKeyPackages).not.toHaveBeenCalled()
    expect(mlsService.uploadMlsKeyPackages).not.toHaveBeenCalled()
  })

  it('should check immediately and again after 24 hours', async () => {
    replenisher.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(DAY_MS)

    expect(mlsService.getAvailableKeyPackageCount).toHaveBeenCalledTimes(2)
  })

  it('should create only one schedule when started twice', async () => {
    replenisher.start()
    replenisher.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(mlsService.getAvailableKeyPackageCount).toHaveBeenCalledOnce()
  })

  it('should continue checking after a failure', async () => {
    vi.mocked(mlsService.getAvailableKeyPackageCount)
      .mockRejectedValueOnce(new Error('backend unavailable'))
      .mockResolvedValue(100)

    replenisher.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(DAY_MS)

    expect(mlsService.getAvailableKeyPackageCount).toHaveBeenCalledTimes(2)
  })

  it('should continue checking after an upload failure', async () => {
    vi.mocked(mlsService.getAvailableKeyPackageCount).mockResolvedValue(49)
    vi.mocked(mlsService.uploadMlsKeyPackages)
      .mockRejectedValueOnce(new Error('backend unavailable'))
      .mockResolvedValue(undefined)

    replenisher.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(DAY_MS)

    expect(mlsService.getAvailableKeyPackageCount).toHaveBeenCalledTimes(2)
    expect(mlsService.uploadMlsKeyPackages).toHaveBeenCalledTimes(2)
  })

  it('should cancel future checks when stopped', async () => {
    replenisher.start()
    await vi.advanceTimersByTimeAsync(0)

    replenisher.stop()
    await vi.advanceTimersByTimeAsync(DAY_MS)

    expect(mlsService.getAvailableKeyPackageCount).toHaveBeenCalledOnce()
  })

  it('should resume checks when restarted', async () => {
    replenisher.start()
    await vi.advanceTimersByTimeAsync(0)
    replenisher.stop()

    replenisher.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(mlsService.getAvailableKeyPackageCount).toHaveBeenCalledTimes(2)
  })

  it('should keep only the new schedule when stopped twice and restarted', async () => {
    replenisher.start()
    await vi.advanceTimersByTimeAsync(0)
    replenisher.stop()
    replenisher.stop()
    replenisher.start()
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(DAY_MS)

    expect(mlsService.getAvailableKeyPackageCount).toHaveBeenCalledTimes(3)
  })
})
