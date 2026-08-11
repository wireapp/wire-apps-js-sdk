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
 * Listener interface for receiving notifications about backend connection state changes.
 *
 * Implement this interface and pass it to {@link WireAppSdk.setBackendConnectionListener}
 * to receive callbacks when the connection to the Wire backend is established or lost.
 *
 * @example
 * ```ts
 * const listener: BackendConnectionListener = {
 *   onConnected: () => console.log('Connected to Wire backend'),
 *   onDisconnected: () => console.log('Disconnected from Wire backend'),
 * }
 * wireAppSdk.setBackendConnectionListener(listener)
 * ```
 */
export interface BackendConnectionListener {
  /**
   * Called when the SDK successfully establishes a connection to the Wire backend
   * (i.e. the WebSocket has opened), before missed notifications are synced.
   */
  onConnected(): void

  /**
   * Called when the SDK loses a connection it had previously established.
   *
   * Fires at most once per connection attempt, and only if `onConnected()` was
   * called for that attempt — a failed initial connect (e.g. timeout) does not
   * trigger this. The SDK will automatically attempt to reconnect unless stopped.
   */
  onDisconnected(): void
}
