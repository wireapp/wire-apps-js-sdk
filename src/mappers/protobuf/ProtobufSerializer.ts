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

import rootMessage, {
  type IText,
  type IGenericMessage,
  type IAsset,
  type Asset,
  type IComposite,
  Confirmation,
} from "../../generated/messages.js";
const { GenericMessage } = rootMessage;
import {
  type WireMessage,
  TextMessage,
  AssetMessage,
  type CompositeMessage,
  type ButtonActionMessage,
  type ButtonActionConfirmationMessage,
  type KnockMessage,
  type LocationMessage,
  type ReactionMessage,
  type MessageDeleteMessage,
  type MessageEditMessage,
  type ConfirmationMessage,
} from '../../model/WireMessage.js';

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
    };

    let builtMessage: IGenericMessage;

    switch (wireMessage.type) {
      case 'text':
        builtMessage = packTextMessage(wireMessage, genericMessage);
        break;

      case 'asset':
        builtMessage = packAssetMessage(wireMessage, genericMessage);
        break;

      case 'composite':
        builtMessage = packCompositeMessage(wireMessage, genericMessage);
        break;

      case 'buttonAction':
        builtMessage = packButtonActionMessage(wireMessage, genericMessage);
        break;

      case 'buttonActionConfirmation':
        builtMessage = packButtonActionConfirmationMessage(wireMessage, genericMessage);
        break;

      case 'knock':
        builtMessage = packKnockMessage(wireMessage, genericMessage);
        break;

      case 'location':
        builtMessage = packLocationMessage(wireMessage, genericMessage);
        break;

      case 'reaction':
        builtMessage = packReactionMessage(wireMessage, genericMessage);
        break;

      case 'messageDelete':
        builtMessage = packMessageDeleteMessage(wireMessage, genericMessage);
        break;

      case 'messageEdit':
        builtMessage = packMessageEditMessage(wireMessage, genericMessage);
        break;

      case 'confirmation':
        builtMessage = packConfirmationMessage(wireMessage, genericMessage);
        break;

      default:
        throw new Error(`Unsupported message type: ${(wireMessage as WireMessage).type}`);
    }

    const message = GenericMessage.create(builtMessage);
    return GenericMessage.encode(message).finish();
  },
};

/**
 * Packs a text message into the GenericMessage format
 */
function packTextMessage(
  wireMessage: TextMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  const textContent: IText = {
    content: wireMessage.text,
    mentions: (wireMessage.mentions ?? []).map(mention => ({
      qualifiedUserId: mention.userId,
      start: mention.offset,
      length: mention.length,
    })),
    linkPreview: (wireMessage.linkPreviews ?? []).map(lp => ({
      url: lp.url,
      urlOffset: lp.urlOffset,
      permanentUrl: lp.permanentUrl ?? null,
      title: lp.title ?? null,
      summary: lp.summary ?? null,
    })),
    expectsReadConfirmation: false,
    legalHoldStatus: null,
  };

  if (wireMessage.quotedMessageId) {
    textContent.quote = {
      quotedMessageId: wireMessage.quotedMessageId!,
      ...(wireMessage.quotedMessageSha256 != null ? { quotedMessageSha256: wireMessage.quotedMessageSha256 } : {})
    };
  }

  if (wireMessage.expiresAfterMillis !== undefined && wireMessage.expiresAfterMillis !== null) {
    return {
      ...genericMessage,
      ephemeral: {
        expireAfterMillis: wireMessage.expiresAfterMillis,
        text: textContent,
      }
    } as IGenericMessage;
  }

  return {
    ...genericMessage,
    text: textContent,
  } as IGenericMessage;
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

  const asset: IAsset = {
    original,
    uploaded
  };

  if (wireMessage.expiresAfterMillis !== undefined && wireMessage.expiresAfterMillis !== null) {
    return {
      ...genericMessage,
      ephemeral: {
        expireAfterMillis: wireMessage.expiresAfterMillis,
        asset
      }
    } as IGenericMessage;
  } else {
    return {
      ...genericMessage,
      asset
    } as IGenericMessage;
  }
}

function buildCompositeProto(wireMessage: CompositeMessage): IComposite {
  return {
    items: wireMessage.items.map(item => {
      if (item.button) {
        return { button: { text: item.button.text, id: item.button.id } }
      } else if (item.text) {
        return { text: { content: item.text.content } }
      }
      return {}
    }),
    expectsReadConfirmation: wireMessage.expectsReadConfirmation ?? false,
  }
}

function packCompositeMessage(
  wireMessage: CompositeMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  return {
    ...genericMessage,
    composite: buildCompositeProto(wireMessage),
  } as IGenericMessage;
}

function packButtonActionMessage(
  wireMessage: ButtonActionMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  return {
    ...genericMessage,
    buttonAction: {
      buttonId: wireMessage.buttonId,
      referenceMessageId: wireMessage.referenceMessageId,
    },
  } as IGenericMessage;
}

function packButtonActionConfirmationMessage(
  wireMessage: ButtonActionConfirmationMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  return {
    ...genericMessage,
    buttonActionConfirmation: {
      referenceMessageId: wireMessage.referenceMessageId,
      buttonId: wireMessage.buttonId ?? undefined,
    },
  } as IGenericMessage;
}

function packKnockMessage(
  wireMessage: KnockMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  const knock = { hotKnock: wireMessage.hotKnock };
  if (wireMessage.expiresAfterMillis != null) {
    return { ...genericMessage, ephemeral: { expireAfterMillis: wireMessage.expiresAfterMillis, knock } } as IGenericMessage;
  }
  return { ...genericMessage, knock } as IGenericMessage;
}

function packLocationMessage(
  wireMessage: LocationMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  const location = {
    longitude: wireMessage.longitude,
    latitude: wireMessage.latitude,
    name: wireMessage.name ?? undefined,
    zoom: wireMessage.zoom ?? undefined,
  };
  if (wireMessage.expiresAfterMillis != null) {
    return { ...genericMessage, ephemeral: { expireAfterMillis: wireMessage.expiresAfterMillis, location } } as IGenericMessage;
  }
  return { ...genericMessage, location } as IGenericMessage;
}

function packReactionMessage(
  wireMessage: ReactionMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  return {
    ...genericMessage,
    reaction: {
      emoji: wireMessage.emoji,
      messageId: wireMessage.targetMessageId,
    },
  } as IGenericMessage;
}

function packMessageDeleteMessage(
  wireMessage: MessageDeleteMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  return {
    ...genericMessage,
    deleted: {
      messageId: wireMessage.targetMessageId,
    },
  } as IGenericMessage;
}

function packMessageEditMessage(
  wireMessage: MessageEditMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  const edited: IGenericMessage['edited'] = {
    replacingMessageId: wireMessage.replacingMessageId,
  };

  if (wireMessage.text != null) {
    edited!.text = { content: wireMessage.text };
  } else if (wireMessage.composite != null) {
    edited!.composite = buildCompositeProto(wireMessage.composite);
  } else {
    throw new Error('MessageEditMessage must have either text or composite content');
  }

  return {
    ...genericMessage,
    edited,
  } as IGenericMessage;
}

function packConfirmationMessage(
  wireMessage: ConfirmationMessage,
  genericMessage: Partial<IGenericMessage>
): IGenericMessage {
  return {
    ...genericMessage,
    confirmation: {
      type: wireMessage.confirmationType === 'read'
        ? Confirmation.Type.READ
        : Confirmation.Type.DELIVERED,
      firstMessageId: wireMessage.firstMessageId,
      moreMessageIds: wireMessage.moreMessageIds ?? [],
    },
  } as IGenericMessage;
}
