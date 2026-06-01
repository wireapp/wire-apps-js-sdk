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

import rootMessage from '../../generated/messages.js';
import type {EncryptionAlgorithm as ProtobufEncryptionAlgorithm} from '../../generated/messages.js';
import {MessageEncryptionAlgorithm} from "../../model/protobuf/MessageEncryptionAlgorithm.js";

const {EncryptionAlgorithm} = rootMessage;

export class EncryptionAlgorithmMapper {
  static fromProtobufModel(encryptionAlgorithm: ProtobufEncryptionAlgorithm | null | undefined): MessageEncryptionAlgorithm | null {
    switch (encryptionAlgorithm) {
      case EncryptionAlgorithm.AES_CBC: return MessageEncryptionAlgorithm.AES_CBC;
      case EncryptionAlgorithm.AES_GCM: return MessageEncryptionAlgorithm.AES_GCM;
      default: return null;
    }
  }

  static toProtobufModel(encryptionAlgorithm: MessageEncryptionAlgorithm | null | undefined): ProtobufEncryptionAlgorithm | null {
    switch (encryptionAlgorithm) {
      case MessageEncryptionAlgorithm.AES_CBC: return EncryptionAlgorithm.AES_CBC;
      case MessageEncryptionAlgorithm.AES_GCM: return EncryptionAlgorithm.AES_GCM;
      default: return null;
    }
  }
}
