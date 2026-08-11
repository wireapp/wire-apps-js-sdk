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

import {obfuscateId} from '../utils/ObfuscateUtil.js'

export class QualifiedId {
  constructor(
    readonly id: string,
    readonly domain: string
  ) {}

  toString(): string {
    return `${obfuscateId(this.id)}@${this.domain}`
  }

  /**
   * Creates a consistent string key from a QualifiedId for use in Mappers and database (e.g. OneToOne conversation name)
   * Format: "id@domain"
   */
  static toKey(qualifiedId: QualifiedId): string {
    return `${qualifiedId.id}@${qualifiedId.domain}`
  }

  /**
   * Reconstructs a QualifiedId object from a string key.
   * Expected format: "id@domain"
   */
  static fromKey(key: string): QualifiedId {
    const [id, domain] = key.split('@')
    return new QualifiedId(id!, domain!)
  }
}
