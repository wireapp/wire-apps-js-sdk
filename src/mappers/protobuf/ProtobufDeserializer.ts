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

import rootMessage from "../../generated/messages.js";
import type {Composite as ProtobufComposite, IGenericMessage} from "../../generated/messages.js";
import { QualifiedId } from "../../model/QualifiedId.js";
const { GenericMessage } = rootMessage;
import {
  TextMessage,
  Unknown,
  AssetMessage,
  CompositeButton,
  CompositeButtonAction,
  CompositeMessage
} from '../../model/WireMessage.js';
import type {
  WireMessage,
  AssetMetadata,
  Image,
  Audio,
  Video,
  AssetRemoteData
} from "../../model/WireMessage.js";
import {MessageEncryptionAlgorithm} from "../../model/protobuf/MessageEncryptionAlgorithm.js";
import {MessageLinkPreviewMapper} from "./MessageLinkPreviewMapper.js";

/**
 * Utility object responsible for mapping a GenericMessage to WireMessage
 */
export const ProtobufDeserializer = {
  /**
   * Converts a GenericMessage to a WireMessage
   */
  toWireMessage: (
    message: Uint8Array,
    qualifiedConversation: QualifiedId
  ): WireMessage => {
    const genericMessage = GenericMessage.decode(message)

    if (genericMessage.text) {
      return unpackTextMessage(genericMessage, qualifiedConversation)
    } else if (genericMessage.asset) {
      return unpackAssetMessage(genericMessage, qualifiedConversation)
    } else if (genericMessage.buttonAction) {
      return unpackCompositeButtonAction(genericMessage, qualifiedConversation)
    } else if (genericMessage.composite) {
      return unpackComposite(genericMessage, qualifiedConversation)
    } else {
      return new Unknown()
    }
  }
}

function unpackTextMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): TextMessage {
  return TextMessage.create({
    // TODO(alexandre): add messageId
    conversationId: qualifiedConversation,
    text: genericMessage.text!.content,
    linkPreviews: genericMessage.text!.linkPreview?.map(it => MessageLinkPreviewMapper.fromProtobuf(it)) ?? []
    // TODO: Map other fields
  })
}

function unpackAssetMessage(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): AssetMessage {
  const asset = genericMessage.asset
  const original = asset?.original

  let metadata: AssetMetadata | null = null

  if (original?.image) {
    metadata = original.image as Image
  } else if (original?.audio) {
    metadata = original.audio as Audio
  } else if (original?.video) {
    metadata = original.video as Video
  }

  let remoteData: AssetRemoteData | null = null
  if (asset?.uploaded) {
    remoteData = {
      otrKey: asset.uploaded.otrKey,
      sha256: asset.uploaded.sha256,
      assetId: asset.uploaded.assetId!,
      assetDomain: asset.uploaded.assetDomain!,
      assetToken: asset.uploaded.assetToken!,
      encryptionAlgorithm: asset.uploaded.encryption as unknown as MessageEncryptionAlgorithm
    }
  }

  return AssetMessage.create({
    conversationId: qualifiedConversation,
    metadata: metadata,
    mimeType: original?.mimeType ?? "*/*",
    name: original?.name ?? null,
    remoteData: remoteData,
    sizeInBytes: original?.size ?? 0
  })
}

function unpackItemList(
  conversationId: QualifiedId,
  compositeItemList: ProtobufComposite.Item.$Properties[]
): (TextMessage | CompositeButton)[] {
  return compositeItemList.flatMap((item): (TextMessage | CompositeButton)[] => {
    switch (item.content) {
      case 'text':
        return item.text ? [TextMessage.create({ conversationId, text: item.text.content })] : []
      case 'button':
        return item.button ? [CompositeButton.create({ id: item.button.id, text: item.button.text })] : []
      default:
        return []
    }
  })
}

function unpackCompositeButtonAction(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): CompositeButtonAction {
  return CompositeButtonAction.create({
    messageId: genericMessage.messageId,
    conversationId: qualifiedConversation,
    referenceMessageId: genericMessage.buttonAction!.referenceMessageId,
    buttonId: genericMessage.buttonAction!.buttonId
  })
}

function unpackComposite(
  genericMessage: IGenericMessage,
  qualifiedConversation: QualifiedId
): CompositeMessage {
  const items = genericMessage.composite!.items!
  const itemList = unpackItemList(qualifiedConversation, items)

  return CompositeMessage.create({
    messageId: genericMessage.messageId,
    conversationId: qualifiedConversation,
    itemList: itemList
  })
}
