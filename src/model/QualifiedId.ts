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

import { ConversationId } from "@wireapp/core-crypto";

export interface QualifiedId {
  id: string
  domain: string
}

export function qualifiedIdToConversationId(qualifiedId: QualifiedId): ConversationId {
  // Remove dashes from UUID and convert to bytes
  const uuidHex = qualifiedId.id.replace(/-/g, '')
  const uuidBytes = new Uint8Array(16)
  for (let index = 0; index < 16; index++) {
    uuidBytes[index] = parseInt(uuidHex.substr(index * 2, 2), 16)
  }

  // Encode domain
  const encoder = new TextEncoder()
  const domainBytes = encoder.encode(qualifiedId.domain)
    
  // Construct the full byte array: 4 byte header + 16 byte UUID + 1 null byte + domain
  const bytes = new Uint8Array(4 + 16 + 1 + domainBytes.length)
    
  // Header
  bytes[0] = 0x00
  bytes[1] = 0x01
  bytes[2] = 0x00
  bytes[3] = 0x00
    
  // UUID
  bytes.set(uuidBytes, 4)
    
  // Null byte separator
  bytes[20] = 0x00
    
  // Domain
  bytes.set(domainBytes, 21)
    
  return new ConversationId(bytes)
}
