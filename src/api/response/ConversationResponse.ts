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

import type { ConversationType } from "../../model/conversation/ConversationType.js"
import type {CryptoProtocol} from "../../model/CryptoProtocol.js"
import type { QualifiedId } from "../../model/QualifiedId.js"
import type { ConversationMembersResponse } from "../model/ConversationMembersResponse.js"
import type { MlsPublicKeysResponse } from "./MlsPublicKeysResponse.js"

export interface ConversationResponse {
  qualified_id: QualifiedId
  name: string | null
  type: ConversationType
  group_id: string | null
  epoch: number | null
  protocol: CryptoProtocol
  team: string | null
  members: ConversationMembersResponse
  public_keys?: MlsPublicKeysResponse | null
  message_timer?: number | null
}
