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

import {describe, expect, it, vi} from 'vitest'
import {MlsService} from '../../src/api/MlsService.js'
import type {MlsApiClient} from '../../src/api/MlsApiClient.js'

describe('MlsService', () => {
  it('should request and return the available key package count for the hexadecimal ciphersuite', async () => {
    const mlsApiClient = {
      getAvailableKeyPackageCount: vi.fn().mockResolvedValue({count: 42})
    } as any as MlsApiClient
    const service = new MlsService(mlsApiClient)

    await expect(service.getAvailableKeyPackageCount(1)).resolves.toBe(42)
    expect(mlsApiClient.getAvailableKeyPackageCount).toHaveBeenCalledWith('0x0001')
  })
})
