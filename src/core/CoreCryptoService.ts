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

import {ConversationId, GroupInfo, isMlsConversationAlreadyExistsError, isMlsOrphanWelcomeError} from "@wireapp/core-crypto";
import {ClientsService} from "../api/ClientsService.js";
import {AppClientId} from "../model/AppClientId.js";
import {
  APP_CLIENT_ID,
  WIRE_CRYPTO_STORAGE_PASSWORD,
  WIRE_USER_DOMAIN,
  WIRE_USER_ID
} from "../utils/DependencyInjectionTokens.js";
import {MlsService} from "../api/MlsService.js";
import {CoreCryptoClient} from "./CoreCryptoClient.js";
import {CoreCryptoMlsTransport} from "./CoreCryptoMlsTransport.js";
import {FeatureConfigsService} from "../api/FeatureConfigsService.js";
import {Decoder} from "bazinga64";
import {container, inject, singleton} from "tsyringe";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import type {QualifiedId} from "../model/QualifiedId.js";
import {AppProperties} from "../service/AppProperties.js";
import type {AddMembersToConversationResult} from "../api/model/AddMembersToConversationResult.js";
import {obfuscateId} from "../utils/ObfuscateUtil.js";

/**
 * Service that handles initialization of CoreCrypto and provides a high-level API for:
 * - Client initialization
 * - Key management
 * - Message encryption and decryption
 */
@singleton()
export class CoreCryptoService {
  private coreCryptoClient: CoreCryptoClient | undefined
  private logger = LoggerFactory.getLogger(this.constructor.name)
  private defaultCiphersuiteCode: number | undefined

  constructor(
    @inject(WIRE_USER_ID) private wireUserId: string,
    @inject(WIRE_USER_DOMAIN) private wireUserDomain: string,
    @inject(WIRE_CRYPTO_STORAGE_PASSWORD) private wireCryptoStoragePassword: string,
    private featureConfigsService: FeatureConfigsService,
    private clientsService: ClientsService,
    private mlsService: MlsService,
    private mlsTransport: CoreCryptoMlsTransport,
    private appProperties: AppProperties
  ) {
  }

  /**
   * Initializes the CoreCryptoClient.
   *
   * Must be called before anything else.
   */
  async initCoreCryptoClient(): Promise<void> {
    this.defaultCiphersuiteCode = await this.featureConfigsService.getDefaultCipherSuite()

    this.coreCryptoClient = await CoreCryptoClient.create(
      this.wireUserId,
      this.defaultCiphersuiteCode,
      this.wireCryptoStoragePassword,
      this.mlsTransport
    )
  }

  /**
   * Initializes existing client device or register a new client device.
   *
   * Must be called only after [this.initCoreCryptoClient] was called first.
   *
   * @note Registers APP_CLIENT_ID token in the container after successful client registration
   */
  async initOrRegisterClient() {
    if (!this.coreCryptoClient) {
      throw new Error("CoreCryptoClient is not initialized.")
    }

    // TODO: Once moved out of in-memory database, then verify for existing deviceId
    this.logger.info("Initializing Proteus Client")
    await this.coreCryptoClient.initProteusClient()
    const proteusPreKeys = await this.coreCryptoClient.generateProteusPreKeys()
    const proteusLastPreKey = await this.coreCryptoClient.generateProteusLastPreKey()

    let registeredDeviceId;
    try {
      registeredDeviceId = await this.clientsService.registerClient(proteusPreKeys, proteusLastPreKey)
    } catch (exception) {
      throw new Error(`Error when registering client: ${(exception as Error).message}`);
    }

    const appClientId = AppClientId.create(
      this.wireUserId,
      registeredDeviceId,
      this.wireUserDomain
    )
    container.registerInstance(APP_CLIENT_ID, appClientId)

    this.logger.info("Initializing MLS Client")
    await this.coreCryptoClient?.initMlsClient(appClientId)
    await this.uploadClientWithMlsPublicKey()
    await this.uploadMlsKeyPackages()

    this.appProperties.setShouldRejoinConversations(true)
  }

  private conversationIdFromMlsGroupId(mlsGroupId: string): ConversationId {
    const mlsGroupIdBytes = Decoder.fromBase64(mlsGroupId).asBytes
    return new ConversationId(mlsGroupIdBytes)
  }

  private async uploadClientWithMlsPublicKey() {
    const mlsPublicKeys = await this.coreCryptoClient!.getMlsPublicKey()
    await this.clientsService.updateClientWithMlsPublicKey(mlsPublicKeys)
  }

  private async uploadMlsKeyPackages() {
    const keyPackages = await this.coreCryptoClient!.mlsGenerateKeyPackages()
    await this.mlsService.uploadMlsKeyPackages(keyPackages)
  }

  async processWelcomeMessage(
    welcomeMessageBytes: Uint8Array,
    groupInfoBytes: Uint8Array
  ) {
    try {
      await this.coreCryptoClient!.processWelcomeMessage(welcomeMessageBytes)
    } catch (exception) {
      if (isMlsOrphanWelcomeError(exception)) {
        this.logger.warn("Cannot process welcome message, asking to join the conversation")
        await this.joinMlsConversation(groupInfoBytes)
      } else {
        this.logger.error("Cannot process welcome message", exception)
      }
    }
  }

  async hasTooFewKeyPackageCount() {
    return this.coreCryptoClient!.hasTooFewKeyPackageCount()
  }

  async mlsGenerateKeyPackages(): Promise<Uint8Array[]> {
    return await this.coreCryptoClient!.mlsGenerateKeyPackages()
  }

  async encryptMls(
    mlsGroupId: string,
    message: Uint8Array
  ): Promise<Uint8Array> {
    const mlsGroupIdBytes = Decoder.fromBase64(mlsGroupId).asBytes
    return await this.coreCryptoClient!.encryptMls(
      new ConversationId(mlsGroupIdBytes),
      message
    )
  }

  async decryptMls(
    mlsGroupId: string,
    encryptedMessage: string
  ): Promise<Uint8Array | undefined> {
    const mlsGroupIdBytes = Decoder.fromBase64(mlsGroupId).asBytes
    const encryptedMessageBytes = Decoder.fromBase64(encryptedMessage).asBytes

    return await this.coreCryptoClient?.decryptMls(
      new ConversationId(mlsGroupIdBytes),
      encryptedMessageBytes
    )
  }

  async wipeConversation(mlsGroupId: string) {
    const conversationId = this.conversationIdFromMlsGroupId(mlsGroupId)
    await this.coreCryptoClient!.wipeConversation(conversationId)
  }

  async conversationExists(mlsGroupId: string) {
    const mlsGroupIdBytes = Decoder.fromBase64(mlsGroupId).asBytes
    return await this.coreCryptoClient?.conversationExists(
      new ConversationId(mlsGroupIdBytes)
    )
  }

  async conversationEpoch(mlsGroupId: string) {
    const mlsGroupIdBytes = Decoder.fromBase64(mlsGroupId).asBytes
    return await this.coreCryptoClient!.conversationEpoch(
      new ConversationId(mlsGroupIdBytes)
    )
  }

  async joinMlsConversation(groupInfoBytes: Uint8Array): Promise<void> {
    await this.coreCryptoClient?.joinMlsConversation(
      new GroupInfo(groupInfoBytes)
    )
  }

  async addMemberToMlsConversation(mlsGroupId: string, members: QualifiedId[]): Promise<AddMembersToConversationResult> {
    if (members.length === 0) {
      throw new Error("List of members cannot be empty.") // TODO: Use custom exceptions (WireException.InvalidParameter)
    }

    const claimedKeyPackagesResult = await this.mlsService.claimKeyPackages(
      members,
      this.defaultCiphersuiteCode!
    )

    await this.coreCryptoClient?.addMemberToMlsConversation(mlsGroupId, claimedKeyPackagesResult.keyPackages)
    // TODO: Handle custom exceptions (if needed) when introduced

    return {
      successUsers: claimedKeyPackagesResult.successUsers,
      failedUsers: claimedKeyPackagesResult.failedUsers
    }
  }

  async removeMembersFromMlsConversation(mlsGroupId: string, clientIds: AppClientId[]){
    this.logger.debug(`Removing ${clientIds.length} members from MLS group id: ${obfuscateId(mlsGroupId)}`)
    await this.coreCryptoClient!.removeMembersFromMlsConversation(mlsGroupId, clientIds)
    this.logger.debug(`Removed ${clientIds.length} members from MLS group id: ${obfuscateId(mlsGroupId)}`)
  }

  async establishMlsConversation(
    userIds: QualifiedId[],
    mlsGroupId: string
  ) {
    const ciphersuite = CoreCryptoClient.getMlsCiphersuiteName(this.defaultCiphersuiteCode!)
    const removalKey = await this.mlsService.getRemovalKey(ciphersuite)

    if (removalKey != null) {
      try {
        await this.coreCryptoClient?.createConversation(
          mlsGroupId,
          removalKey
        )
      } catch (exception) {
        if (isMlsConversationAlreadyExistsError(exception)) {
          throw Error("Conversation already exists.")
        }
      }

      const users = [
        {
          id: this.wireUserId,
          domain: this.wireUserDomain
        } as QualifiedId,
        ...userIds
      ]

      const claimedKeyPackagesResult = await this.mlsService.claimKeyPackages(
        users,
        this.defaultCiphersuiteCode!
      )

      if (claimedKeyPackagesResult.keyPackages.length === 0) {
        await this.coreCryptoClient!.updateKeyingMaterial(mlsGroupId)
      } else {
        await this.coreCryptoClient?.addMemberToMlsConversation(
          mlsGroupId,
          claimedKeyPackagesResult.keyPackages
        )
      }
    } else {
      // TODO: Map to WireException
      throw Error("No Public Keys found, skipping creating a conversation.")
    }
  }

  close() {
    return this.coreCryptoClient?.close()
  }
}
