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

export class CryptoClientId {
  readonly userId: string
  readonly deviceId: string
  readonly userDomain: string

  private constructor(
    userId: string,
    deviceId: string,
    userDomain: string
  ) {
    this.userId = userId
    this.deviceId = deviceId
    this.userDomain = userDomain
  }

  static create(userId: string, deviceId: string, userDomain: string): CryptoClientId {
    return new CryptoClientId(
      userId,
      deviceId,
      userDomain
    )
  }
}

