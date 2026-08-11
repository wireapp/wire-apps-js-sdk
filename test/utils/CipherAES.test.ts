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

import {describe, expect, test} from 'vitest'
import {AESUtils} from '../../src/utils/AESUtils.js'
import fs from 'fs'

describe('AES utils', () => {
  test('given file, when encrypted and decrypted, then not changed', () => {
    const filename = 'banana-icon.png'
    const path = `./test/fixtures/${filename}`
    fs.readFile(path, (err, data) => {
      if (err) {
        throw err
      }

      const key = AESUtils.generateRandomAES256Key().keyMaterial
      const encryptedFile = AESUtils.encryptData(data, key)
      const decryptedFile = AESUtils.decryptData(encryptedFile, key)

      expect(decryptedFile).toStrictEqual(data)
    })
  })

  test('given key generator, when called twice, then outputs are unique', () => {
    const key1 = AESUtils.generateRandomAES256Key()
    const key2 = AESUtils.generateRandomAES256Key()

    expect(key1).not.toBe(key2)
  })

  test('given key generator, when invoked, then returned key size is 32 bytes', () => {
    const cryptoKeyInfo = AESUtils.generateRandomAES256Key()

    expect(cryptoKeyInfo.keyMaterial.length).toBe(32)
  })

  test('given invalid key length, when encrypting or decrypting, then exception is thrown', () => {
    const invalidKey = new Uint8Array(16)
    const data = new Uint8Array()

    expect(() => AESUtils.encryptData(data, invalidKey)).toThrowError()
    expect(() => AESUtils.decryptData(data, invalidKey)).toThrowError()
  })
})
