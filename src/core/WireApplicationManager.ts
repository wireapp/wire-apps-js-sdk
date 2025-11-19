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

import type { MlsService } from "../api/MlsService.js";
import { ProtobufSerializer } from "../model/protobuf/ProtobufSerializer.js";
import type { WireMessage } from "../model/WireMessage.js";
import type { CoreCryptoClient } from "./CoreCryptoClient.js";

export class WireApplicationManager {
  private coreCryptoClient: CoreCryptoClient
  private mlsService: MlsService

  constructor(
    coreCryptoClient: CoreCryptoClient,
    mlsService: MlsService
  ) {
    this.coreCryptoClient = coreCryptoClient
    this.mlsService = mlsService
  }

  async sendMessage(message: WireMessage): Promise<string> {
    const protobufMessage = ProtobufSerializer.toGenericMessageByteArray(message)
    const encryptedMessage = await this.coreCryptoClient.encryptMls(
      message.conversationId,
      protobufMessage
    )

    await this.mlsService.sendMessage(encryptedMessage)

    return message.id
  }
}
