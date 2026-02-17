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

import crypto from 'crypto';
import assert from 'node:assert';

const KEY_SIZE = 256
const KEY_SIZE_BYTES = KEY_SIZE / 8
const algorithm = `aes-${KEY_SIZE}-cbc`
const BLOCK_SIZE = 128;
const IV_SIZE_BYTES = BLOCK_SIZE / 8;

export const AESUtils = {
  decryptData(encryptedData: Uint8Array, key: Uint8Array) {
    const iv = encryptedData.slice(0, IV_SIZE_BYTES)
    const decipher = crypto.createDecipheriv(algorithm, key, iv)

    return Buffer.concat([decipher.update(encryptedData.subarray(IV_SIZE_BYTES)), decipher.final()])
  },

  generateRandomAES256Key(): Uint8Array {
    return crypto.randomBytes(KEY_SIZE_BYTES)
  },

  encryptData(data: Uint8Array, key: Uint8Array) {
    const iv = crypto.randomBytes(IV_SIZE);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);

    return Buffer.concat([cipher.update(Buffer.concat([iv, data])), cipher.final()]);
  }
}
