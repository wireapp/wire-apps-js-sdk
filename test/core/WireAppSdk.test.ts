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

import {EventEmitter} from 'node:events'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {container} from 'tsyringe'
import {existsSync, mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, relative, resolve} from 'node:path'
import {
  WireAppSdk,
  WireApplicationManager as ExportedWireApplicationManager,
  type WireAppSdkOptions
} from '../../src/index.js'
import {WireApplicationManager} from '../../src/core/WireApplicationManager.js'
import {WireEventsHandler} from '../../src/core/WireEventsHandler.js'
import {InvalidParameterError} from '../../src/exception/WireException.js'
import {WIRE_STORAGE_PATH} from '../../src/utils/DependencyInjectionTokens.js'
import type {Logger} from '../../src/utils/logger/Logger.js'
import {AppProperties} from '../../src/service/AppProperties.js'
import {DatabaseService} from '../../src/db/DatabaseService.js'

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
  })

  describe('exit handlers', () => {
    const EXIT_EVENTS = ['SIGINT', 'SIGTERM', 'uncaughtException', 'unhandledRejection'] as const
    type ExitEvent = (typeof EXIT_EVENTS)[number]
    type Listener = (...args: any[]) => unknown

    // process.listeners() has no overload for a union of event names
    const processEmitter: EventEmitter = process
    const silentLogger: Logger = {debug: () => {}, info: () => {}, warn: () => {}, error: () => {}}

    let listenersBefore: Record<ExitEvent, Listener[]>
    let exitSpy: ReturnType<typeof vi.spyOn>

    const snapshotListeners = () =>
      Object.fromEntries(EXIT_EVENTS.map((event) => [event, processEmitter.listeners(event) as Listener[]])) as Record<
        ExitEvent,
        Listener[]
      >

    // Listeners added since the test started, i.e. the ones registered by the SDK
    const addedListeners = (event: ExitEvent) =>
      (processEmitter.listeners(event) as Listener[]).filter((listener) => !listenersBefore[event].includes(listener))

    const createSdkWithStubbedInit = (options?: WireAppSdkOptions) => {
      // close() clears the container, so register the stubs again for every instance
      container.registerInstance(AppProperties, {saveBackendCookieIfMissing: vi.fn()} as unknown as AppProperties)
      container.registerInstance(DatabaseService, {close: vi.fn()} as unknown as DatabaseService)

      return WireAppSdk.create(
        'api-token',
        'https://wire.example.com',
        new Uint8Array(32),
        new (class extends WireEventsHandler {})(),
        silentLogger,
        options
      )
    }

    // Lets a pending handleExit() run to completion, so later calls to process.exit() would be seen
    const flushPromises = () => new Promise((done) => setImmediate(done))

    // Stubs the steps of init() that touch the disk or need a Wire backend
    beforeEach(() => {
      vi.spyOn(WireAppSdk.prototype as any, 'prepareStorage').mockImplementation(() => {})
      vi.spyOn(WireAppSdk.prototype as any, 'configureDependencyTokens').mockImplementation(() => {})
      vi.spyOn(WireAppSdk.prototype as any, 'configureApplicationIdentity').mockResolvedValue(undefined)
      vi.spyOn(WireAppSdk.prototype as any, 'resolveRuntimeDependencies').mockImplementation(() => {})
      vi.spyOn(WireAppSdk.prototype as any, 'initCryptoClient').mockResolvedValue(undefined)
      exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)

      listenersBefore = snapshotListeners()
    })

    afterEach(() => {
      // Never leave a listener behind that could call process.exit() in another test
      for (const event of EXIT_EVENTS) {
        addedListeners(event).forEach((listener) => process.off(event, listener))
      }
      vi.restoreAllMocks()
    })

    it('registers a listener for every exit event by default', async () => {
      await createSdkWithStubbedInit()

      for (const event of EXIT_EVENTS) {
        expect(addedListeners(event)).toHaveLength(1)
      }
    })

    it('registers no listeners when registerExitHandlers is false', async () => {
      await createSdkWithStubbedInit({registerExitHandlers: false})

      for (const event of EXIT_EVENTS) {
        expect(process.listenerCount(event)).toBe(listenersBefore[event].length)
      }
    })

    it('removes only its own listeners on close', async () => {
      const hostListener = () => {}
      process.on('SIGTERM', hostListener)

      try {
        const sdk = await createSdkWithStubbedInit()
        await sdk.close()

        expect(process.listeners('SIGTERM')).toContain(hostListener)
        expect(process.listenerCount('SIGTERM')).toBe(listenersBefore.SIGTERM.length + 1)
        for (const event of ['SIGINT', 'uncaughtException', 'unhandledRejection'] as const) {
          expect(process.listenerCount(event)).toBe(listenersBefore[event].length)
        }
      } finally {
        process.off('SIGTERM', hostListener)
      }
    })

    it('removes its listeners when init fails', async () => {
      vi.spyOn(WireAppSdk.prototype as any, 'initCryptoClient').mockRejectedValue(new Error('init failed'))

      await expect(createSdkWithStubbedInit()).rejects.toThrow('init failed')

      for (const event of EXIT_EVENTS) {
        expect(process.listenerCount(event)).toBe(listenersBefore[event].length)
      }
    })

    it('does not accumulate listeners across repeated create and close', async () => {
      for (let i = 0; i < 5; i++) {
        const sdk = await createSdkWithStubbedInit()
        await sdk.close()
      }

      for (const event of EXIT_EVENTS) {
        expect(process.listenerCount(event)).toBe(listenersBefore[event].length)
      }
    })

    it.each(['SIGINT', 'SIGTERM'] as const)('closes and exits with code 0 on %s', async (signal) => {
      const sdk = await createSdkWithStubbedInit()
      const closeSpy = vi.spyOn(sdk, 'close')

      addedListeners(signal)[0]!(signal)

      await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0))
      expect(closeSpy).toHaveBeenCalledOnce()
      expect(addedListeners(signal)).toHaveLength(0)
    })

    it('exits with code 1 when close fails after a signal', async () => {
      const sdk = await createSdkWithStubbedInit()
      vi.spyOn(sdk, 'close').mockRejectedValue(new Error('close failed'))

      addedListeners('SIGTERM')[0]!('SIGTERM')

      await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1))
      expect(exitSpy).not.toHaveBeenCalledWith(0)
    })

    it.each([
      ['uncaughtException', new Error('boom')],
      ['unhandledRejection', 'rejected']
    ] as const)('closes and exits with code 1 on %s', async (event, error) => {
      const sdk = await createSdkWithStubbedInit()
      const closeSpy = vi.spyOn(sdk, 'close')

      addedListeners(event)[0]!(error)

      await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1))
      expect(closeSpy).toHaveBeenCalledOnce()
      expect(exitSpy).not.toHaveBeenCalledWith(0)
    })

    it('handles only the first exit event', async () => {
      await createSdkWithStubbedInit()
      const sigterm = addedListeners('SIGTERM')[0]!
      const uncaughtException = addedListeners('uncaughtException')[0]!

      sigterm('SIGTERM')
      uncaughtException(new Error('boom'))

      await vi.waitFor(() => expect(exitSpy).toHaveBeenCalled())
      await flushPromises()
      expect(exitSpy).toHaveBeenCalledOnce()
      expect(exitSpy).toHaveBeenCalledWith(0)
    })
  })
})
