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

import {singleton} from 'tsyringe'
import {MlsService} from '../api/MlsService.js'
import {MLS_DEFAULT_KEY_PACKAGE_COUNT} from '../core/CoreCryptoClient.js'
import {CoreCryptoService} from '../core/CoreCryptoService.js'
import {LoggerFactory} from '../utils/logger/LoggerFactory.js'

@singleton()
export class KeyPackageReplenisher {
  private static readonly CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000
  private logger = LoggerFactory.getLogger(this.constructor.name)
  private activeRun: object | undefined
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private mlsService: MlsService,
    private coreCryptoService: CoreCryptoService
  ) {}

  start(): void {
    if (this.activeRun) return

    const run = {}
    this.activeRun = run
    void this.checkAndSchedule(run)
  }

  stop(): void {
    this.activeRun = undefined
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
  }

  private async checkAndSchedule(run: object): Promise<void> {
    try {
      const count = await this.mlsService.getAvailableKeyPackageCount(
        this.coreCryptoService.getDefaultCiphersuiteCode()
      )
      if (count < MLS_DEFAULT_KEY_PACKAGE_COUNT / 2) {
        this.logger.info(
          `Found ${count} available MLS key packages, replenishing with ${MLS_DEFAULT_KEY_PACKAGE_COUNT} new packages`
        )
        const keyPackages = await this.coreCryptoService.mlsGenerateKeyPackages()
        await this.mlsService.uploadMlsKeyPackages(keyPackages)
      } else {
        this.logger.info(`Found ${count} available MLS key packages, replenishment is not needed`)
      }
    } catch (exception) {
      this.logger.error('Failed to check or replenish MLS key packages', exception)
    }

    if (run === this.activeRun) {
      this.timer = setTimeout(() => void this.checkAndSchedule(run), KeyPackageReplenisher.CHECK_INTERVAL_MS)
    }
  }
}
