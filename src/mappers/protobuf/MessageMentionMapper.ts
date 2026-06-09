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

import type {IMention} from "../../generated/messages.js";
import {QualifiedId} from "../../model/QualifiedId.js";
import type {Mention} from "../../model/WireMessage.js";

export class MessageMentionMapper {
  static fromProtobuf(mention: IMention): Mention[] {
    if (!mention.qualifiedUserId?.id || !mention.qualifiedUserId?.domain) {
      return [];
    }
    return [{
      userId: new QualifiedId(mention.qualifiedUserId.id, mention.qualifiedUserId.domain),
      offset: mention.start,
      length: mention.length
    }];
  }

  static toProtobuf(mention: Mention): IMention {
    return {
      qualifiedUserId: {
        id: mention.userId.id,
        domain: mention.userId.domain
      },
      start: mention.offset,
      length: mention.length
    } as IMention
  }
}
