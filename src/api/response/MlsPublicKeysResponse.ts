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

import {CipherSuite} from "@wireapp/core-crypto/native";
import type {MlsPublicKeys} from "../../model/MlsPublicKeys.js";
import {Decoder} from "bazinga64";

export interface MlsPublicKeysResponse {
  removal: MlsPublicKeys
}

export function getRemovalKeyFromPublicKeysResponse(
  mlsPublicKeysResponse: MlsPublicKeysResponse,
  cipherSuite: CipherSuite
): Uint8Array | null {
  let key: string | null | undefined

  switch (cipherSuite) {
    case CipherSuite.Mls128Dhkemp256Aes128gcmSha256P256:
      key = mlsPublicKeysResponse.removal.ecdsa_secp256r1_sha256
      break;

    case CipherSuite.Mls256Dhkemp384Aes256gcmSha384P384:
      key = mlsPublicKeysResponse.removal.ecdsa_secp384r1_sha384
      break;

    case CipherSuite.Mls256Dhkemp521Aes256gcmSha512P521:
      key = mlsPublicKeysResponse.removal.ecdsa_secp521r1_sha512
      break;

    case CipherSuite.Mls128Dhkemx25519Chacha20poly1305Sha256Ed25519:
    case CipherSuite.Mls128Dhkemx25519Aes128gcmSha256Ed25519:
      key = mlsPublicKeysResponse.removal.ed25519
      break;

    case CipherSuite.Mls256Dhkemx448Aes256gcmSha512Ed448:
    case CipherSuite.Mls256Dhkemx448Chacha20poly1305Sha512Ed448:
      throw new Error("Unsupported ciphersuite")

    default:
      key = null
  }

  return key ? Decoder.fromBase64(key).asBytes : null
}
