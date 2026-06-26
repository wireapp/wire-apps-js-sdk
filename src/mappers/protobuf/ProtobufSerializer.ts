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
import type {
  Composite as ProtobufComposite,
  IText,
  IGenericMessage,
  IAsset,
  IButtonAction,
  Asset,
  IButtonActionConfirmation
} from "../../generated/messages.js";
const { GenericMessage, Composite, Ephemeral, Knock, Location: ProtobufLocation, MessageDelete, Confirmation, Reaction: ProtobufReaction } = rootMessage;
import type {
  WireMessage,
  Item,
  Ping,
  Location,
  DeletedMessage,
  Receipt,
  Reaction
} from '../../model/WireMessage.js';
import {
  TextMessage,
  AssetMessage,
  CompositeButton,
  CompositeButtonAction,
  CompositeButtonActionConfirmation,
  CompositeMessage,
  ReceiptType
} from '../../model/WireMessage.js';
import {MessageLinkPreviewMapper} from "./MessageLinkPreviewMapper.js";
import {MessageMentionMapper} from "./MessageMentionMapper.js";

/**
 * Utility object responsible for serializing WireMessage to GenericMessage
 */
export const ProtobufSerializer = {
  /**
   * Converts a WireMessage to a GenericMessage Byte Array
   *
   * @param wireMessage The message to serialize
   * @returns Uint8Array containing the serialized protobuf message
   * @throws Error if the message type is not supported
   */
  toGenericMessageByteArray: (wireMessage: WireMessage): Uint8Array => {
    const genericMessage: Partial<IGenericMessage> = {
      messageId: wireMessage.id,
    }

    let builtMessage: IGenericMessage;

    switch (wireMessage.type) {
      case 'text':
        builtMessage = packTextMessage(wireMessage, genericMessage)
        break

      case 'asset':
        builtMessage = packAssetMessage(wireMessage, genericMessage)
        break
      
      case 'composite_button_action':
        builtMessage = packCompositeButtonAction(wireMessage, genericMessage)
        break

      case 'composite_button_action_confirmation':
        builtMessage = packCompositeButtonActionConfirmation(wireMessage, genericMessage)
        break
      
      case 'composite':
        builtMessage = packCompositeMessage(wireMessage, genericMessage)
        break
      
      case 'ping':
        builtMessage = packPing(wireMessage, genericMessage)
        break

      case 'location':
        builtMessage = packLocation(wireMessage, genericMessage)
        break

      case 'deleted':
        builtMessage = packDeletedMessage(wireMessage, genericMessage)
        break

      case 'receipt':
        builtMessage = packReceipt(wireMessage, genericMessage)
        break

      case 'reaction':
        builtMessage = packReaction(wireMessage, genericMessage)
        break

        // TODO: Add other message types here

      default:
        throw new Error(`Unsupported message type: ${(wireMessage as WireMessage).type}`);
    }

    const message = GenericMessage.create(builtMessage);
    return GenericMessage.encode(message).finish();
  },
}

/**
 * Packs a text message into the GenericMessage format
 */
function packTextMessage(
  wireMessage: TextMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  const textContent = packText(wireMessage)

  return {
    ...genericMessage,
    ...(wireMessage.expiresAfterMillis
      ? {
        ephemeral: Ephemeral.create({
          expireAfterMillis: wireMessage.expiresAfterMillis,
          text: textContent
        })
      }
      : {
        text: textContent
      })
  } as IGenericMessage
}

function packText(
  wireMessage: TextMessage
) {
  const textContent: IText = {
    content: wireMessage.text,
    // Add other text-specific fields
    mentions: wireMessage.mentions?.map(MessageMentionMapper.toProtobuf) ?? [],
    linkPreview: wireMessage.linkPreviews?.map(it => MessageLinkPreviewMapper.toProtobuf(it)) ?? [],
    expectsReadConfirmation: false,
    legalHoldStatus: null
  };

  if (wireMessage.quotedMessageId) {
    textContent.quote = {
      quotedMessageId: wireMessage.quotedMessageId!,
      ...(wireMessage.quotedMessageSha256 !== undefined ? { quotedMessageSha256: wireMessage.quotedMessageSha256 } : {})
    };
  }

  return textContent
}

function packAssetMessage(
  wireMessage: AssetMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  const original: Asset.IOriginal = {
    mimeType: wireMessage.mimeType,
    size: wireMessage.sizeInBytes,
    name: wireMessage.name ?? null
  };

  if (wireMessage.metadata) {
    if (wireMessage.metadata.type === 'image') {
      original.image = {
        width: wireMessage.metadata.width,
        height: wireMessage.metadata.height
      };
    } else if (wireMessage.metadata.type === 'audio') {
      original.audio = {};
      if (wireMessage.metadata.durationMs) {
        original.audio.durationInMillis = wireMessage.metadata.durationMs;
      }
      if (wireMessage.metadata.normalizedLoudness) {
        original.audio.normalizedLoudness = wireMessage.metadata.normalizedLoudness;
      }
    } else if (wireMessage.metadata.type === 'video') {
      original.video = {};
      if (wireMessage.metadata.width) {
        original.video.width = wireMessage.metadata.width;
      }
      if (wireMessage.metadata.height) {
        original.video.height = wireMessage.metadata.height;
      }
      if (wireMessage.metadata.durationMs) {
        original.video.durationInMillis = wireMessage.metadata.durationMs;
      }
    }
  }

  const uploaded: Asset.IRemoteData = {
    otrKey: wireMessage.remoteData?.otrKey || new Uint8Array(),
    sha256: wireMessage.remoteData?.sha256 || new Uint8Array(),
    assetId: wireMessage.remoteData?.assetId || null,
    assetToken: wireMessage.remoteData?.assetToken || null,
    assetDomain: wireMessage.remoteData?.assetDomain || null
  };

  const assetContent: IAsset = {
    original,
    uploaded
  };

  return {
    ...genericMessage,
    ...(wireMessage.expiresAfterMillis
      ? {
        ephemeral: Ephemeral.create({
          expireAfterMillis: wireMessage.expiresAfterMillis,
          asset: assetContent
        })
      }
      : {
        asset: assetContent
      })
  } as IGenericMessage
}

function packItemList(itemsList: Item[]): ProtobufComposite.Item[] {
  return itemsList.flatMap((item) => {
    switch ((item as TextMessage | CompositeButton).type) {
      case 'composite_button': {
        const button = item as CompositeButton
        return [Composite.Item.create({
          content: 'button',
          button: { id: button.id, text: button.text }
        })]
      }
      case 'text': {
        return [Composite.Item.create({
          content: 'text',
          text: packText(item as TextMessage)
        })]
      }
      default:
        return []
    }
  })
}

function packCompositeButtonAction(
  wireMessage: CompositeButtonAction,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  const buttonAction: IButtonAction = {
    referenceMessageId: wireMessage.referenceMessageId,
    buttonId: wireMessage.buttonId
  }

  return {
    ...genericMessage,
    buttonAction: buttonAction
  } as IGenericMessage;
}

function packCompositeButtonActionConfirmation(
  wireMessage: CompositeButtonActionConfirmation,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  const buttonActionConfirmation: IButtonActionConfirmation = {
    referenceMessageId: wireMessage.referenceMessageId,
    buttonId: wireMessage.buttonId
  }

  return {
    ...genericMessage,
    buttonActionConfirmation: buttonActionConfirmation
  } as IGenericMessage
}

function packCompositeMessage(
  wireMessage: CompositeMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  return {
    ...genericMessage,
    composite: Composite.create({
      items: packItemList(wireMessage.items)
    })
  } as IGenericMessage
}

function packPing(
  wireMessage: Ping,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  const knock = Knock.create({ hotKnock: false })
  return {
    ...genericMessage,
    ...(wireMessage.expiresAfterMillis
      ? {
        ephemeral: Ephemeral.create({
          expireAfterMillis: wireMessage.expiresAfterMillis,
          knock: knock
        })
      }
      : {
        knock: knock
      })  
  } as IGenericMessage
}

function packLocation(
  wireMessage: Location,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  const locationContent = ProtobufLocation.create({
    latitude: wireMessage.latitude,
    longitude: wireMessage.longitude,
    name: wireMessage.name,
    zoom: wireMessage.zoom
  })

  return {
    ...genericMessage,
    ...(wireMessage.expiresAfterMillis
      ? {
        ephemeral: Ephemeral.create({
          expireAfterMillis: wireMessage.expiresAfterMillis,
          location: locationContent
        })
      }
      : {
        location: locationContent
      })
  } as IGenericMessage
}

function packDeletedMessage(
  wireMessage: DeletedMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  return {
    ...genericMessage,
    deleted: MessageDelete.create({
      messageId: wireMessage.messageId
    })
  } as IGenericMessage
}

function packReceipt(
  wireMessage: Receipt,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  let type
  switch (wireMessage.receiptType) {
    case ReceiptType.DELIVERED:
      type = Confirmation.Type.DELIVERED
      break
    case ReceiptType.READ:
      type = Confirmation.Type.READ
      break
  }

  const [firstMessageId, ...moreMessageIds] = wireMessage.messageIds;

  if (!firstMessageId) {
    throw new Error("First messageId for Receipt message type is null") // TODO: Change to WireException once implemented
  }

  return {
    ...genericMessage,
    confirmation: Confirmation.create({
      type: type,
      firstMessageId: firstMessageId,
      moreMessageIds: moreMessageIds
    })
  } as IGenericMessage
}

function packReaction(
  wireMessage: Reaction,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  const emojis = [...wireMessage.emojiSet]
    .map(emojiString => emojiString.trim())
    .filter(emojiString => emojiString.length > 0)
    .join(",")

  return {
    ...genericMessage,
    reaction: ProtobufReaction.create({
      messageId: wireMessage.messageId,
      emoji: emojis
    })
  } as IGenericMessage
}
