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
import { MlsService } from "../api/MlsService.js";
import { ProtobufSerializer } from "../mappers/protobuf/ProtobufSerializer.js";
import type { WireMessage } from "../model/WireMessage.js";
import { CoreCryptoService } from "./CoreCryptoService.js";
import { ConversationService } from "../api/ConversationService.js";

@Service()
export class WireApplicationManager {
  
  constructor(
    private coreCryptoService: CoreCryptoService,
    private conversationService: ConversationService,
    private mlsService: MlsService
  ) {}

  async sendMessage(message: WireMessage): Promise<string> {
    const mlsGroupId =
      await this.conversationService.getConversationMLSGroupId(message.conversationId)

    const protobufMessage = ProtobufSerializer.toGenericMessageByteArray(message)
    const encryptedMessage = await this.coreCryptoService.encryptMls(
      mlsGroupId,
      protobufMessage
    )

    await this.mlsService.sendMessage(encryptedMessage)

    return message.id
  }
}
