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

import {Ciphersuite} from "@wireapp/core-crypto";
import type {MlsPublicKeys} from "../../model/MlsPublicKeys.js";
import {Decoder} from "bazinga64";

export interface MlsPublicKeysResponse {
  removal: MlsPublicKeys
}

export function getRemovalKeyFromPublicKeysResponse(
  mlsPublicKeysResponse: MlsPublicKeysResponse,
  cipherSuite: Ciphersuite
): Uint8Array | null {
  let key: string | null | undefined

  switch (cipherSuite) {
    case Ciphersuite.MLS_128_DHKEMP256_AES128GCM_SHA256_P256:
      key = mlsPublicKeysResponse.removal.ecdsa_secp256r1_sha256
      break;

    case Ciphersuite.MLS_256_DHKEMP384_AES256GCM_SHA384_P384:
      key = mlsPublicKeysResponse.removal.ecdsa_secp384r1_sha384
      break;

    case Ciphersuite.MLS_256_DHKEMP521_AES256GCM_SHA512_P521:
      key = mlsPublicKeysResponse.removal.ecdsa_secp521r1_sha512
      break;

    case Ciphersuite.MLS_128_DHKEMX25519_CHACHA20POLY1305_SHA256_Ed25519:
    case Ciphersuite.MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519:
      key = mlsPublicKeysResponse.removal.ed25519
      break;

    case Ciphersuite.MLS_256_DHKEMX448_AES256GCM_SHA512_Ed448:
    case Ciphersuite.MLS_256_DHKEMX448_CHACHA20POLY1305_SHA512_Ed448:
      throw new Error("Unsupported ciphersuite")

    default:
      key = null
  }

  return key ? Decoder.fromBase64(key).asBytes : null
}
