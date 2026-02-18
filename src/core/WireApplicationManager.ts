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

import { MlsService } from "../api/MlsService.js";
import { ProtobufSerializer } from "../mappers/protobuf/ProtobufSerializer.js";
import type { AssetMetadata, AssetRemoteData, WireMessage } from "../model/WireMessage.js";
import { AssetMessage } from "../model/WireMessage.js"
import { CoreCryptoService } from "./CoreCryptoService.js";
import { ConversationService } from "../api/ConversationService.js";
import { singleton } from "tsyringe";
import { AssetsTransferService } from "../api/AssetsTransferService.js";
import type { QualifiedId } from "../model/QualifiedId.js";
import type { AssetRetention } from "../api/model/asset/AssetRetention.js";

@singleton()
export class WireApplicationManager {

  constructor(
    private coreCryptoService: CoreCryptoService,
    private conversationService: ConversationService,
    private mlsService: MlsService,
    private assetsTransferService: AssetsTransferService
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

  async downloadAsset(assetRemoteData: AssetRemoteData): Promise<Uint8Array> {
    return await this.assetsTransferService.downloadAsset(assetRemoteData)
  }

  async sendAsset(
    conversationId: QualifiedId,
    asset: Uint8Array,
    name: string,
    mimeType: string,
    metadata?: AssetMetadata | null,
    retention?: AssetRetention
  ): Promise<string> {
    const remoteData = await this.assetsTransferService.uploadAsset(asset, retention)

    const assetMessage = AssetMessage.create({
      conversationId: conversationId,
      metadata: metadata ?? null,
      mimeType: mimeType,
      name: name,
      remoteData: remoteData,
      sizeInBytes: asset.length
    })

    return await this.sendMessage(assetMessage)
  }
}
