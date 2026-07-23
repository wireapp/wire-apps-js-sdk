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

import {ConversationId, CoreCryptoError, GroupInfo, MlsError} from "@wireapp/core-crypto/native";
import {ClientsService} from "../api/ClientsService.js";
import {CryptoClientId} from "../model/CryptoClientId.js";
import {
  WIRE_CRYPTOGRAPHY_STORAGE_KEY,
  WIRE_USER_DOMAIN,
  WIRE_USER_ID
} from "../utils/DependencyInjectionTokens.js";
import {MlsService} from "../api/MlsService.js";
import {CoreCryptoClient} from "./CoreCryptoClient.js";
import {CoreCryptoMlsTransport} from "./CoreCryptoMlsTransport.js";
import {FeatureConfigsService} from "../api/FeatureConfigsService.js";
import {Decoder} from "bazinga64";
import {inject, singleton} from "tsyringe";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import type {QualifiedId} from "../model/QualifiedId.js";
import {AppProperties} from "../service/AppProperties.js";
import type {AddMembersToConversationResult} from "../api/model/AddMembersToConversationResult.js";
import {obfuscateClientId, obfuscateId} from "../utils/ObfuscateUtil.js";
import {type MlsPublicKeysResponse} from "../api/response/MlsPublicKeysResponse.js";

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
    @inject(WIRE_CRYPTOGRAPHY_STORAGE_KEY) private cryptographyStorageKey: Uint8Array,
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
      this.cryptographyStorageKey,
      this.mlsTransport
    )
  }

  /**
   * Initializes existing client device or register a new client device.
   *
   * Must be called only after [this.initCoreCryptoClient] was called first.
   *
   * @note Saves the given deviceId (if first time for registration) into AppProperties
   */
  async initOrRegisterClient() {
    if (!this.coreCryptoClient) {
      throw new Error("CoreCryptoClient is not initialized.")
    }

    if (this.appProperties.hasDeviceId()) {
      const storedDeviceId = this.appProperties.getDeviceId()
      this.logger.info(`Loading MLS Client for deviceId: ${obfuscateClientId(storedDeviceId)}`)
      const cryptoClientId = CryptoClientId.create(
        this.wireUserId,
        storedDeviceId,
        this.wireUserDomain
      )

      await this.coreCryptoClient.initMlsClient(cryptoClientId)
      this.appProperties.setShouldRejoinConversations(false)
    } else {
      this.logger.info("App doesn't have a client. Creating one.")
      this.logger.info(`Initializing Proteus Client. appId: ${obfuscateId(this.wireUserId)}`)
      await this.coreCryptoClient.initProteusClient()

      const proteusPreKeys = await this.coreCryptoClient.generateProteusPreKeys()
      const proteusLastPreKey = await this.coreCryptoClient.generateProteusLastPreKey()

      let registeredDeviceId;
      try {
        registeredDeviceId = await this.clientsService.registerClient(proteusPreKeys, proteusLastPreKey)
      } catch (exception) {
        throw new Error(`Error when registering client: ${(exception as Error).message}`);
      }

      this.appProperties.setDeviceId(registeredDeviceId)

      const cryptoClientId = CryptoClientId.create(
        this.wireUserId,
        registeredDeviceId,
        this.wireUserDomain
      )

      this.logger.info(`Initializing MLS Client. userId: ${obfuscateId(this.wireUserId)}, deviceId: ${obfuscateClientId(registeredDeviceId)}`)

      await this.coreCryptoClient.initMlsClient(cryptoClientId)
      await this.uploadClientWithMlsPublicKey()
      await this.uploadMlsKeyPackages()

      this.appProperties.setShouldRejoinConversations(true)
    }
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
      if (CoreCryptoError.Mls.instanceOf(exception) && MlsError.OrphanWelcome.instanceOf(exception.inner.mlsError)) {
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

    return await this.coreCryptoClient!.decryptMls(
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
    return await this.coreCryptoClient!.conversationExists(
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
    await this.coreCryptoClient!.joinMlsConversation(
      new GroupInfo(groupInfoBytes)
    )
  }

  async addClientsToMlsConversation(mlsGroupId: string, members: QualifiedId[]): Promise<AddMembersToConversationResult> {
    this.logger.debug(`Adding ${members.length} clients to MLS group id: ${obfuscateId(mlsGroupId)}`)
    if (members.length === 0) {
      throw new Error("List of members cannot be empty.") // TODO: Use custom exceptions (WireException.InvalidParameter)
    }

    const claimedKeyPackagesResult = await this.mlsService.claimKeyPackages(
      members,
      this.defaultCiphersuiteCode!
    )

    if (claimedKeyPackagesResult.keyPackages.length === 0) {
      await this.coreCryptoClient!.updateKeyingMaterial(mlsGroupId)
    } else {
      await this.coreCryptoClient!.addClientsToMlsConversation(mlsGroupId, claimedKeyPackagesResult.keyPackages)
    }

    this.logger.debug(`Added ${claimedKeyPackagesResult.successUsers.length} clients to MLS group id: ${obfuscateId(mlsGroupId)}`)
    return {
      membersAdded: claimedKeyPackagesResult.successUsers,
      membersFailedToAdd: claimedKeyPackagesResult.failedUsers
    }
  }

  async removeClientsFromMlsConversation(mlsGroupId: string, clientIds: CryptoClientId[]){
    this.logger.debug(`Removing ${clientIds.length} clients from MLS group id: ${obfuscateId(mlsGroupId)}`)
    await this.coreCryptoClient!.removeClientsFromMlsConversation(mlsGroupId, clientIds)
    this.logger.debug(`Removed ${clientIds.length} clients from MLS group id: ${obfuscateId(mlsGroupId)}`)
  }

  async establishMlsConversation(
    mlsGroupId: string,
    mlsPublicKeysResponse?: MlsPublicKeysResponse // Exists only for 1-1 conversations
  ): Promise<void> {
    if (!mlsGroupId) {
      throw new Error("Missing mlsGroupId.") //TODO: Use custom exceptions
    }

    const cipherSuite = CoreCryptoClient.getMlsCiphersuiteName(this.defaultCiphersuiteCode!)
    const removalKey = await this.mlsService.getRemovalKey(cipherSuite, mlsPublicKeysResponse)
    if (removalKey == null) {
      throw Error("No Public Keys found, skipping creating a conversation.") // TODO: Map to WireException
    }

    try {
      this.logger.debug(`Creating MLS conversation in CoreCrypto. mlsGroupId: ${obfuscateId(mlsGroupId)}`)
      await this.coreCryptoClient!.createConversation(mlsGroupId, removalKey)
    } catch (exception) {
      if (CoreCryptoError.Mls.instanceOf(exception) && MlsError.ConversationAlreadyExists.instanceOf(exception.inner.mlsError)) {
        throw Error("Conversation already exists.")
      }
      this.logger.error(`Failed to create MLS conversation. mlsGroupId: ${obfuscateId(mlsGroupId)}`, exception)
    }
  }
}
