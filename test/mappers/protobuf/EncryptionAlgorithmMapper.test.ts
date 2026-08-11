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

import {describe, expect, it} from 'vitest'
import protobufMessage from '../../../src/generated/messages.js'
import {EncryptionAlgorithmMapper} from '../../../src/mappers/protobuf/EncryptionAlgorithmMapper.js'
import {MessageEncryptionAlgorithm} from '../../../src/model/protobuf/MessageEncryptionAlgorithm.js'

describe('EncryptionAlgorithmMapper', () => {
  it('maps protobuf encryption algorithms to domain algorithms', () => {
    expect(EncryptionAlgorithmMapper.fromProtobufModel(protobufMessage.EncryptionAlgorithm.AES_CBC)).toBe(
      MessageEncryptionAlgorithm.AES_CBC
    )
    expect(EncryptionAlgorithmMapper.fromProtobufModel(protobufMessage.EncryptionAlgorithm.AES_GCM)).toBe(
      MessageEncryptionAlgorithm.AES_GCM
    )
    expect(EncryptionAlgorithmMapper.fromProtobufModel(null)).toBe(MessageEncryptionAlgorithm.AES_CBC)
    expect(EncryptionAlgorithmMapper.fromProtobufModel(undefined)).toBe(MessageEncryptionAlgorithm.AES_CBC)
  })

  it('maps domain encryption algorithms to protobuf algorithms', () => {
    expect(EncryptionAlgorithmMapper.toProtobufModel(MessageEncryptionAlgorithm.AES_CBC)).toBe(
      protobufMessage.EncryptionAlgorithm.AES_CBC
    )
    expect(EncryptionAlgorithmMapper.toProtobufModel(MessageEncryptionAlgorithm.AES_GCM)).toBe(
      protobufMessage.EncryptionAlgorithm.AES_GCM
    )
  })
})
