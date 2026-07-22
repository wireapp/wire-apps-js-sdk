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

import {singleton} from "tsyringe";
import {MlsApiClient} from "./MlsApiClient.js";
import type {CipherSuite} from "@wireapp/core-crypto/native";
import {getRemovalKeyFromPublicKeysResponse, type MlsPublicKeysResponse} from "./response/MlsPublicKeysResponse.js";
import type {ClaimedKeyPackagesResult} from "../model/ClaimedKeyPackagesResult.js";
import type {QualifiedId} from "../model/QualifiedId.js";
import type {KeyPackage} from "./response/ClaimedKeyPackageList.js";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import {obfuscateId} from "../utils/ObfuscateUtil.js";
import {Decoder} from "bazinga64";
import type {HttpRetryPolicy} from "../core/HttpRetryPolicy.js";

@singleton()
export class MlsService {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  constructor(private mlsApiClient: MlsApiClient) { }

  async uploadCommitBundle(commitBundle: Uint8Array): Promise<void> {
    await this.mlsApiClient.uploadCommitBundle(commitBundle)
  }

  async sendMessage(message: Uint8Array): Promise<void> {
    await this.mlsApiClient.sendMessage(message)
  }

  async uploadMlsKeyPackages(
    mlsKeyPackages: Uint8Array[],
    retryPolicy?: HttpRetryPolicy
  ): Promise<void> {
    await this.mlsApiClient.uploadMlsKeyPackages(mlsKeyPackages, retryPolicy)
  }

  async getRemovalKey(
    cipherSuite: CipherSuite,
    existingPublicKeysResponse?: MlsPublicKeysResponse,
    retryPolicy?: HttpRetryPolicy
  ): Promise<Uint8Array | null> {
    const publicKeysResponse = existingPublicKeysResponse ?? await this.mlsApiClient.getPublicKeys(retryPolicy)
    return getRemovalKeyFromPublicKeysResponse(publicKeysResponse, cipherSuite)
  }

  async claimKeyPackages(
    users: QualifiedId[],
    ciphersuite: number
  ): Promise<ClaimedKeyPackagesResult> {

    const claimedKeyPackages: KeyPackage[] = []
    const successUsers: QualifiedId[] = []
    const failedUsers: QualifiedId[] = []

    const ciphersuiteHex = this.toHexString(ciphersuite)

    for (const user of users) {
      try {
        const result = await this.mlsApiClient.claimKeyPackages(
          user.id,
          user.domain,
          ciphersuiteHex
        )

        if (result.key_packages.length > 0) {
          successUsers.push(user)
          claimedKeyPackages.push(...result.key_packages)
        }
      } catch (exception) {
        // Ignoring when claiming key packages fails for a user
        // as for now there is no retry
        failedUsers.push(user)
        this.logger.error(
          `Error when claiming key packages for userId: ${obfuscateId(user.id)}: ${exception}`
        )
      }
    }

    return {
      keyPackages: claimedKeyPackages.map(claimedKeyPackage => {
        return Decoder.fromBase64(claimedKeyPackage.key_package).asBytes
      }),
      successUsers: successUsers,
      failedUsers: failedUsers
    } as ClaimedKeyPackagesResult
  }

  private toHexString(value: number, minDigits: number = 4): string {
    return "0x" + value.toString(16).padStart(minDigits, '0')
  }
}
