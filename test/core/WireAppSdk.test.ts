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
import {container} from 'tsyringe'
import {existsSync, mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, relative, resolve} from 'node:path'
import {WireAppSdk, WireApplicationManager as ExportedWireApplicationManager} from '../../src/index.js'
import {WireApplicationManager} from '../../src/core/WireApplicationManager.js'
import {WireEventsHandler} from '../../src/core/WireEventsHandler.js'
import {InvalidParameterError} from '../../src/exception/WireException.js'
import {WIRE_STORAGE_PATH} from '../../src/utils/DependencyInjectionTokens.js'
import type {Logger} from '../../src/utils/logger/Logger.js'

describe('WireAppSdk', () => {
  afterEach(() => {
    container.clearInstances()
  })

  const createSdk = () => Object.create(WireAppSdk.prototype) as WireAppSdk

  it('exposes the WireApplicationManager instance', () => {
    const applicationManager = {} as WireApplicationManager
    container.registerInstance(WireApplicationManager, applicationManager)
    const sdk = createSdk()

    expect(sdk.getApplicationManager()).toBe(applicationManager)
  })

  it('returns the same WireApplicationManager instance as WireEventsHandler.manager', () => {
    const applicationManager = {} as WireApplicationManager
    container.registerInstance(WireApplicationManager, applicationManager)
    const sdk = createSdk()
    const eventsHandler = new (class extends WireEventsHandler {})()

    expect(sdk.getApplicationManager()).toBe(applicationManager)
    expect(eventsHandler.manager).toBe(applicationManager)
  })

  it('exports WireApplicationManager from the package root', () => {
    expect(ExportedWireApplicationManager).toBe(WireApplicationManager)
  })

  describe('storagePath option', () => {
    const API_TOKEN = 'api-token'
    const API_HOST = 'https://wire.example.com'
    const STORAGE_KEY = new Uint8Array(32)
    const silentLogger: Logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()}
    const eventsHandler = new (class extends WireEventsHandler {})()

    let storagePath: string
    let sdk: WireAppSdk | undefined

    // The storage and database steps of create() run for real; the steps that need a
    // Wire backend (identity, CoreCrypto, runtime dependencies) and the process-wide
    // exit handlers are stubbed out.
    const createSdk = (options?: {storagePath?: string}) =>
      WireAppSdk.create(API_TOKEN, API_HOST, STORAGE_KEY, eventsHandler, silentLogger, options)

    beforeEach(() => {
      storagePath = mkdtempSync(join(tmpdir(), 'wire-apps-sdk-'))
      const prototype = WireAppSdk.prototype as any
      vi.spyOn(prototype, 'registerExitHandlers').mockImplementation(() => {})
      vi.spyOn(prototype, 'configureApplicationIdentity').mockResolvedValue(undefined)
      vi.spyOn(prototype, 'resolveRuntimeDependencies').mockImplementation(() => {})
      vi.spyOn(prototype, 'initCryptoClient').mockResolvedValue(undefined)
    })

    afterEach(async () => {
      await sdk?.close()
      sdk = undefined
      vi.restoreAllMocks()
      rmSync(storagePath, {recursive: true, force: true})
    })

    it('creates the database and cryptography storage in the given directory', async () => {
      const appStoragePath = join(storagePath, 'nested', 'app')

      sdk = await createSdk({storagePath: appStoragePath})

      expect(existsSync(join(appStoragePath, 'apps.db'))).toBe(true)
      expect(existsSync(join(appStoragePath, 'cryptography'))).toBe(true)
      expect(container.resolve(WIRE_STORAGE_PATH)).toBe(appStoragePath)
    })

    it('resolves a relative storagePath against the working directory at creation time', async () => {
      const relativeStoragePath = relative(process.cwd(), storagePath)

      sdk = await createSdk({storagePath: relativeStoragePath})

      expect(container.resolve(WIRE_STORAGE_PATH)).toBe(resolve(relativeStoragePath))
      expect(existsSync(join(storagePath, 'apps.db'))).toBe(true)
    })

    it('defaults to ./storage in the working directory', () => {
      // Built without create() so that the test does not write to the repository's ./storage.
      const WireAppSdkConstructor = WireAppSdk as any
      const defaultSdk = new WireAppSdkConstructor(API_TOKEN, API_HOST, STORAGE_KEY, eventsHandler, silentLogger)

      defaultSdk.configureDependencyTokens()

      expect(container.resolve(WIRE_STORAGE_PATH)).toBe(resolve('./storage'))
    })

    it.each(['', '   '])('rejects an empty storagePath (%j)', async (emptyStoragePath) => {
      await expect(createSdk({storagePath: emptyStoragePath})).rejects.toThrow(InvalidParameterError)
    })

    it('rejects options passed in the logger position', async () => {
      const misplacedOptions = {storagePath: join(storagePath, 'app')} as unknown as Logger

      await expect(
        WireAppSdk.create(API_TOKEN, API_HOST, STORAGE_KEY, eventsHandler, misplacedOptions)
      ).rejects.toThrow('pass undefined as the fifth argument')
      expect(existsSync(join(storagePath, 'app'))).toBe(false)
    })
  })
})
