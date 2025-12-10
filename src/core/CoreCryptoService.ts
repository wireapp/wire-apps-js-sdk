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

import { ConversationId } from "@wireapp/core-crypto";
import { Container, Inject, Service } from "typedi";
import { ClientsService } from "../api/ClientsService.js";
import { RegisterClientRequest } from "../api/request/RegisterClientRequest.js";
import { mapToPreKeyRequest } from "../mappers/PreKeyMapper.js";
import { AppClientId } from "../model/AppClientId.js";
import { APP_CLIENT_ID, WIRE_CRYPTO_STORAGE_PASSWORD, WIRE_USER_DOMAIN, WIRE_USER_ID, WIRE_USER_PASSWORD } from "../utils/DependencyInjectionTokens.js";
import { MlsService } from "../api/MlsService.js";
import { CoreCryptoClient } from "./CoreCryptoClient.js";
import { CoreCryptoMlsTransport } from "./CoreCryptoMlsTransport.js";
import { FeatureConfigsService } from "../api/FeatureConfigsService.js";
import { Decoder } from "bazinga64";

/**
 * Service that handles initialization of CoreCrypto and provides a high-level API for:
 * - Client initialization
 * - Key management
 * - Message encryption and decryption
 */
@Service()
export class CoreCryptoService {
  private coreCryptoClient: CoreCryptoClient | undefined

  constructor(
    @Inject(WIRE_USER_ID) private userId: string,
    @Inject(WIRE_USER_DOMAIN) private userDomain: string,
    @Inject(WIRE_CRYPTO_STORAGE_PASSWORD) private cryptographyStoragePassword: string,
    private featureConfigsService: FeatureConfigsService,
    private clientsService: ClientsService,
    private mlsService: MlsService,
    private mlsTransport: CoreCryptoMlsTransport
  ) {}

  /**
   * Initializes the CoreCryptoClient.
   * 
   * Must be called before anything else.
   */
  async initCoreCryptoClient(): Promise<void> {
    const defaultCiphersuite =  (await this.featureConfigsService.getFeatureConfigs()).mls.config.defaultCipherSuite

    this.coreCryptoClient = await CoreCryptoClient.create(
      this.userId,
      defaultCiphersuite,
      this.cryptographyStoragePassword,
      this.mlsTransport
    )
  }
  
  /**
   * Initializes existing client device or register a new client device.
   * 
   * Must be called only after [this.initCoreCryptoClient] was called first.
   */
  async initOrRegisterClient() {
    if (!this.coreCryptoClient) {
      throw new Error("CoreCryptoClient is not initialized.")
    }

    // TODO: Once moved out of in-memory database, then verify for existing deviceId
    console.log("Initializing Proteus Client")
    await this.coreCryptoClient.initProteusClient()
    const preKeys = await this.coreCryptoClient.generateProteusPreKeys()
    const lastPreKey = await this.coreCryptoClient.generateProteusLastPreKey()

    let clientResponse;
    try {
      const registerClientRequest = new RegisterClientRequest(
        Container.get<string>(WIRE_USER_PASSWORD),
        mapToPreKeyRequest(lastPreKey),
        preKeys.map((preKey) =>
          mapToPreKeyRequest(preKey)
        )
      )
      clientResponse = await this.clientsService.registerClient(registerClientRequest)
    } catch (error) {
      throw new Error(`Error when registering client: ${(error as Error).message}`);
    }

    const appClientId = AppClientId.create(
      this.userId,
      clientResponse.id,
      this.userDomain
    )
    Container.set(APP_CLIENT_ID, appClientId)

    console.log("Initializing MLS Client")
    await this.coreCryptoClient?.initMlsClient(appClientId)
    await this.uploadClientWithMlsPublicKey()
    await this.uploadMlsKeyPackages()

    // TODO: setShouldRejoinConverastions(true) when its a new client
  }

  private async uploadClientWithMlsPublicKey() {
    const mlsPublicKeys = await this.coreCryptoClient!.getMlsPublicKey()
    await this.clientsService.updateClientWithMlsPublicKey(mlsPublicKeys)
  }

  private async uploadMlsKeyPackages() {
    const keyPackages = await this.coreCryptoClient!.mlsGenerateKeyPackages()
    await this.mlsService.uploadMlsKeyPackages(keyPackages)
  }

  async processWelcomeMessage(welcomeMessageBytes: Uint8Array) {
    await this.coreCryptoClient!.processWelcomeMessage(welcomeMessageBytes)
    // TODO: Handle MlsException.OrphanWelcome in try/catch
    // TODO: Request to join conversation by external commit
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

  close() {
    this.coreCryptoClient!.close()
  }
}
