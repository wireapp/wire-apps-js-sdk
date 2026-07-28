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

import {HashUtils} from "../../utils/HashUtils.js";
import {concatToBuffer} from "../../utils/BufferUtils.js";
import type {WireMessage} from "../../model/WireMessage.js";

const MILLIS_IN_SEC = 1000;
const COORDINATES_ROUNDING = 1000;
const LONG_SIZE_BYTES = 8;

export class EncodedMessageContent {
  readonly byteArray: Buffer;
  readonly asHexString: string;
  readonly sha256Digest: Buffer;

  constructor(byteArray: Buffer) {
    this.byteArray = byteArray;
    this.asHexString = toInternalHexString(byteArray);
    this.sha256Digest = HashUtils.calculateSha256Hash(byteArray);
  }
}

/**
 * Converts a string into a UTF-16BE encoded byte array.
 */
function toUTF16BEByteArray(value: string): Buffer {
  const result = Buffer.alloc(value.length * 2);
  for (let i = 0; i < value.length; i++) {
    result.writeUInt16BE(value.charCodeAt(i), i * 2);
  }
  return result;
}

/**
 * Converts an integer (safe up to 2^53) into an 8-byte big-endian byte array.
 */
function toByteArray(value: number): Buffer {
  const result = Buffer.alloc(LONG_SIZE_BYTES);
  result.writeBigInt64BE(BigInt(Math.trunc(value)));
  return result;
}

/**
 * Converts a byte array into a lowercase hex string.
 */
function toInternalHexString(value: Uint8Array): string {
  return Buffer.from(value).toString('hex');
}

function encodeMessageTimeStampInMillis(messageTimeStampInMillis: number): Buffer {
  const messageTimeStampInSec = Math.floor(messageTimeStampInMillis / MILLIS_IN_SEC);
  return toByteArray(messageTimeStampInSec);
}

function wrapIntoResult(
  messageTimeStampByteArray: Buffer,
  messageTextBodyUTF16BE: Buffer
): EncodedMessageContent {
  const bom = new Uint8Array([0xfe, 0xff]);
  return new EncodedMessageContent(
    concatToBuffer(bom, messageTextBodyUTF16BE, messageTimeStampByteArray)
  );
}

function encodeMessageAsset(messageTimeStampInMillis: number, assetId: string): EncodedMessageContent {
  return wrapIntoResult(
    encodeMessageTimeStampInMillis(messageTimeStampInMillis),
    toUTF16BEByteArray(assetId)
  );
}

function encodeMessageTextBody(
  messageTimeStampInMillis: number,
  messageTextBody: string
): EncodedMessageContent {
  return wrapIntoResult(
    encodeMessageTimeStampInMillis(messageTimeStampInMillis),
    toUTF16BEByteArray(messageTextBody)
  );
}

function encodeLocationCoordinates(
  latitude: number,
  longitude: number,
  messageTimeStampInMillis: number
): EncodedMessageContent {
  const latitudeBEBytes = toByteArray(Math.round(latitude * COORDINATES_ROUNDING));
  const longitudeBEBytes = toByteArray(Math.round(longitude * COORDINATES_ROUNDING));
  const timestampBytes = encodeMessageTimeStampInMillis(messageTimeStampInMillis);

  return new EncodedMessageContent(
    concatToBuffer(latitudeBEBytes, longitudeBEBytes, timestampBytes)
  );
}

export const MessageContentEncoder = {
  encodeMessageContent(message: WireMessage): EncodedMessageContent | null {
    switch (message.type) {
      case 'asset':
        return message.remoteData?.assetId
          ? encodeMessageAsset(new Date(message.timestamp).getTime(), message.remoteData.assetId)
          : null;

      case 'text':
        return encodeMessageTextBody(new Date(message.timestamp).getTime(), message.text);

      case 'location':
        return encodeLocationCoordinates(message.latitude, message.longitude, new Date(message.timestamp).getTime());

      default:
        console.warn('Attempting to encode message with unsupported content type');
        return null;
    }
  }
};
