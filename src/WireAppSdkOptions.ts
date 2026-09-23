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

/**
 * Optional settings for {@link WireAppSdk.create}.
 */
export interface WireAppSdkOptions {
  /**
   * Directory where the SDK keeps its local state: the `apps.db` SQLite database and the
   * `cryptography` folder with the app's MLS keys and device state.
   *
   * Relative paths are resolved against `process.cwd()` once, when the SDK is created.
   * The directory is created if it does not exist. Each app needs its own directory, and it must
   * persist across restarts: if it is lost, the app comes back as a new device.
   *
   * @default './storage'
   */
  storagePath?: string

  /**
   * Whether the SDK handles `SIGINT`, `SIGTERM`, `uncaughtException` and `unhandledRejection` by
   * calling {@link WireAppSdk.close} and exiting the process: with code 0 after a signal, and with
   * code 1 after an error or a failed close. Set it to `false` when the host application manages the
   * process lifecycle; it must then call {@link WireAppSdk.close} itself on shutdown.
   *
   * @default true
   */
  registerExitHandlers?: boolean
}
