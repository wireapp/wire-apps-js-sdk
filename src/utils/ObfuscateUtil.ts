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

const START_INDEX = 0
const END_INDEX_ID = 7
const END_INDEX_CLIENT_ID = 3

export function obfuscateId(value: string, lastChar: number = END_INDEX_ID): string {
  if (value.length < END_INDEX_ID) {
    return value
  } else {
    return value.substring(START_INDEX, lastChar) + '***'
  }
}

export function obfuscateClientId(value: string): string {
  return obfuscateId(value, END_INDEX_CLIENT_ID)
}
