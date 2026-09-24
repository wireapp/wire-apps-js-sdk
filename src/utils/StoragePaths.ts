/*
 * Wire
 * Copyright (C) 2025 Wire Swiss GmbH
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

import {join} from 'node:path'

// Relative paths are resolved against process.cwd() when the SDK is created, so
// by default host apps get the SDK-managed storage folder in the directory where
// the process starts. Host apps can override it with `WireAppSdkOptions.storagePath`.
export const DEFAULT_STORAGE_PATH = './storage'

export function getDatabasePath(storagePath: string): string {
  return join(storagePath, 'apps.db')
}

export function getCryptographyStoragePath(storagePath: string): string {
  return join(storagePath, 'cryptography')
}
