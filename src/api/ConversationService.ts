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

import { Service } from "typedi";
import { HttpClient } from "../core/HttpClient.js";
import type { QualifiedId } from "../model/QualifiedId.js";
import type { ConversationResponse } from "./response/ConversationResponse.js";
import { decodeBase64Bytes } from "../utils/Base64Util.js";
import type { MLSGroupId } from "../model/mls/MLSGroupId.js";

@Service()
export class ConversationService {
  constructor(private httpClient: HttpClient) {}
    
  async getConversation(conversationId: QualifiedId): Promise<ConversationResponse> {
    const response = await this.httpClient.getRequest<Record<string, unknown>>(`conversations/${conversationId.domain}/${conversationId.id}`)

    return {
      groupId: response["group_id"] as string
    }
  }

  getDecodedMlsGroupId(conversation: ConversationResponse): MLSGroupId {
    if (!conversation.groupId) {
      // TODO: Map to WireException
      throw new Error("MLSGroupId should not be empty or null.")
    }
    
    const decodedBytes = decodeBase64Bytes(conversation.groupId)
    return decodedBytes
  }
}
