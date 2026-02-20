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

import { CapabilitiesRequest } from "./CapabilitiesRequest.js"
import type { PreKeyRequest } from "./PreKeyRequest.js"

export class RegisterClientRequest {
  password: string
  lastkey: PreKeyRequest
  prekeys: PreKeyRequest[]
  capabilities: CapabilitiesRequest[]
  type: string
  model: string

  constructor(
    password: string,
    lastKey: PreKeyRequest,
    preKeys: PreKeyRequest[],
    capabilities: CapabilitiesRequest[] = this.DEFAULT_CAPABILITIES,
    type: string = this.DEFAULT_CLIENT_TYPE,
    model: string = this.DEFAULT_CLIENT_MODEL
  ) {
    this.password = password
    this.lastkey = lastKey
    this.prekeys = preKeys
    this.capabilities = capabilities
    this.type = type
    this.model = model
  }

  private DEFAULT_CLIENT_TYPE = "temporary"
  private DEFAULT_CLIENT_MODEL = "Typescript App Client"
  private DEFAULT_CAPABILITIES: CapabilitiesRequest[] = [
    CapabilitiesRequest.LEGALHOLD_IMPLICIT_CONSENT
  ]
}
