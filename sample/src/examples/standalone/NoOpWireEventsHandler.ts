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

import {WireEventsHandler} from '@wireapp/wire-apps-js-sdk'

/**
 * This class is intentionally left blank. It will not react to any events.
 * It is used by the standalone examples, which only drive the SDK themselves
 * and don't need to handle any incoming event.
 */
export class NoOpWireEventsHandler extends WireEventsHandler {}
