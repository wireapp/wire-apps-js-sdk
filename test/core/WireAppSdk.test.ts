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

import {afterEach, describe, expect, it} from 'vitest'
import {container} from 'tsyringe'
import {WireAppSdk, WireApplicationManager as ExportedWireApplicationManager} from '../../src/index.js'
import {WireApplicationManager} from '../../src/core/WireApplicationManager.js'
import {WireEventsHandler} from '../../src/core/WireEventsHandler.js'

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
})
