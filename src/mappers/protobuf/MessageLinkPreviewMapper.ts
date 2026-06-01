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

import type {Asset, ILinkPreview} from "../../generated/messages.js";
import {MessageEncryptionAlgorithm} from "../../model/protobuf/MessageEncryptionAlgorithm.js";
import type {LinkPreview} from "../../model/WireMessage.js";
import {EncryptionAlgorithmMapper} from "./EncryptionAlgorithmMapper.js";

export class MessageLinkPreviewMapper {
  static fromProtobuf(linkPreview: ILinkPreview): LinkPreview | null {
    const hasImage = linkPreview.image != null

    return {
      summary: linkPreview.summary ?? null,
      title: linkPreview.title ?? null,
      url: linkPreview.url,
      urlOffset: linkPreview.urlOffset ?? 0,
      permanentUrl: linkPreview.permanentUrl ?? null,
      image: hasImage
        ? {
          mimeType: linkPreview.image?.original?.mimeType ?? '*/*',
          assetDataSize: linkPreview.image?.original?.size ?? 0,
          assetName: linkPreview.image?.original?.name ?? null,
          assetHeight: linkPreview.image?.original?.image?.height ?? 0,
          assetWidth: linkPreview.image?.original?.image?.width ?? 0,
          assetDataPath: null,
          assetToken: linkPreview.image?.uploaded?.assetToken ?? null,
          assetDomain: linkPreview.image?.uploaded?.assetDomain ?? null,
          assetKey: linkPreview.image?.uploaded?.assetId ?? null,
          metadata: null,
          otrKey: linkPreview.image?.uploaded?.otrKey ?? new Uint8Array(0),
          sha256Key: linkPreview.image?.uploaded?.sha256 ?? new Uint8Array(0),
          encryptionAlgorithm: EncryptionAlgorithmMapper.fromProtobufModel(linkPreview.image?.uploaded?.encryption)
            ?? MessageEncryptionAlgorithm.AES_CBC
        } : null
    }
  }

  static toProtobuf(linkPreview: LinkPreview): ILinkPreview {
    const result: ILinkPreview = {
      url: linkPreview.url,
      urlOffset: linkPreview.urlOffset,
      permanentUrl: linkPreview.permanentUrl ?? null,
      title: linkPreview.title ?? null,
      summary: linkPreview.summary ?? null
    }

    if (linkPreview.image) {
      const image = linkPreview.image

      const original: Asset.IOriginal = {
        size: image.assetDataSize,
        mimeType: image.mimeType,
        image: {
          width: image.assetWidth,
          height: image.assetHeight,
        },
        name: image.assetName ?? null
      }

      const uploaded = {
        otrKey: image.otrKey,
        sha256: image.sha256Key,
        assetId: image.assetKey ?? null,
        assetToken: image.assetToken ?? null,
        assetDomain: image.assetDomain ?? null,
        encryption: EncryptionAlgorithmMapper.toProtobufModel(image.encryptionAlgorithm)
      }

      result.image = {
        original,
        uploaded
      }
    }

    return result
  }
}
