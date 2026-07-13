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

import {
  CipherSuite,
  ClientId,
  ConversationId,
  CoreCrypto,
  Credential,
  CredentialRef,
  Database,
  DatabaseKey,
  DeviceId,
  ExternalSender,
  GroupInfo,
  KeyPackage,
  proteusLastResortPrekeyId,
  Uuid,
  Welcome
} from "@wireapp/core-crypto/native";
import type {CryptoClientId} from "../model/CryptoClientId.js";
import {CoreCryptoMlsTransport} from "./CoreCryptoMlsTransport.js";
import type {MlsPublicKeys} from "../model/MlsPublicKeys.js";
import {PreKeyCrypto} from "../model/PreKeyCrypto.js";
import {Decoder, Encoder} from "bazinga64";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import {obfuscateId} from "../utils/ObfuscateUtil.js";

// TODO: Baris: If we can find a way to make this class only reachable from CoreCryptoService, that will be awesome.

export class CoreCryptoClient {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  private ciphersuite: CipherSuite
  private mlsTransport: CoreCryptoMlsTransport
  private coreCrypto: CoreCrypto
  private credential?: CredentialRef

  private constructor(
    ciphersuite: number,
    mlsTransport: CoreCryptoMlsTransport,
    coreCrypto: CoreCrypto
  ) {
    this.ciphersuite = ciphersuite
    this.mlsTransport = mlsTransport
    this.coreCrypto = coreCrypto
  }

  static async create(
    userId: string,
    ciphersuiteCode: number,
    cryptographyStoragePassword: string,
    mlsTransport: CoreCryptoMlsTransport
  ): Promise<CoreCryptoClient> {
    const uint8Array = new TextEncoder().encode(cryptographyStoragePassword);

    const db = await Database.open(
      `./storage/cryptography/${userId}`,
      new DatabaseKey(uint8Array)
    )
    const coreCrypto = CoreCrypto.new(db)

    const coreCryptoClient = new CoreCryptoClient(
      this.getMlsCiphersuiteName(ciphersuiteCode),
      mlsTransport,
      coreCrypto
    )

    return coreCryptoClient
  }

  static getMlsCiphersuiteName(ciphersuiteCode: number): CipherSuite {
    switch (ciphersuiteCode) {
      case 1:
        return CipherSuite.Mls128Dhkemx25519Aes128gcmSha256Ed25519
      case 2:
        return CipherSuite.Mls128Dhkemp256Aes128gcmSha256P256
      case 3:
        return CipherSuite.Mls128Dhkemx25519Chacha20poly1305Sha256Ed25519
      case 4:
        return CipherSuite.Mls256Dhkemx448Aes256gcmSha512Ed448
      case 5:
        return CipherSuite.Mls256Dhkemp521Aes256gcmSha512P521
      case 6:
        return CipherSuite.Mls256Dhkemx448Chacha20poly1305Sha512Ed448
      case 7:
        return CipherSuite.Mls256Dhkemp384Aes256gcmSha384P384
      default:
        return CipherSuite.Mls128Dhkemx25519Aes128gcmSha256Ed25519
    }
  }

  async initMlsClient(cryptoClientId: CryptoClientId) {
    const clientId = new ClientId(
      new Uuid(cryptoClientId.userId),
      DeviceId.fromHexString(cryptoClientId.deviceId),
      cryptoClientId.userDomain
    )

    await this.coreCrypto.transaction(async (context) => {
      await context.mlsInit(
        clientId,
        this.mlsTransport
      )

      const credentials = await this.coreCrypto.getCredentials()
      if (credentials.length == 0) {
        this.logger.info(`Creating CoreCrypto Credential`)
        const credential = Credential.basic(
          this.ciphersuite,
          clientId
        )
        this.credential = await context.addCredential(credential)
      } else {
        this.logger.info(`Loading CoreCrypto Credential`)
        this.credential = credentials[0]!
      }
    })
  }

  async mlsGenerateKeyPackages(count: number = this.MLS_DEFAULT_KEYPACKAGE_COUNT): Promise<Uint8Array[]> {
    return await this.coreCrypto.transaction(async (context) => {
      const keyPackages: Uint8Array[] = []
      for (let i = 0; i < count; i++) {
        const kp = await context.generateKeyPackage(this.credential!)
        keyPackages.push(kp.serialize())
      }

      return keyPackages
    })
  }

  async getMlsPublicKey(): Promise<MlsPublicKeys> {
    const key = await this.coreCrypto.publicKey(this.credential!)
    const encodedKey = Encoder.toBase64(key).asString

    switch (this.ciphersuite) {
      case CipherSuite.Mls128Dhkemp256Aes128gcmSha256P256:
        return {ecdsa_secp256r1_sha256: encodedKey};

      case CipherSuite.Mls256Dhkemp384Aes256gcmSha384P384:
        return {ecdsa_secp384r1_sha384: encodedKey};

      case CipherSuite.Mls256Dhkemp521Aes256gcmSha512P521:
        return {ecdsa_secp521r1_sha512: encodedKey};

      case CipherSuite.Mls128Dhkemx25519Chacha20poly1305Sha256Ed25519:
      case CipherSuite.Mls128Dhkemx25519Aes128gcmSha256Ed25519:
        return {ed25519: encodedKey};

      case CipherSuite.Mls256Dhkemx448Aes256gcmSha512Ed448:
      case CipherSuite.Mls256Dhkemx448Chacha20poly1305Sha512Ed448:
        // TODO: Map to WireException
        throw new Error("Unsupported ciphersuite")

      default:
        // TODO: Map to WireException
        throw new Error("Unknown ciphersuite");
    }
  }

  async initProteusClient() {
    await this.coreCrypto.transaction(async (context) => {
      await context.proteusInit()
    })
  }

  async generateProteusPreKeys(
    from: number = this.PROTEUS_PREKEYS_FROM_COUNT,
    count: number = this.PROTEUS_PREKEYS_MAX_COUNT
  ): Promise<PreKeyCrypto[]> {
    return await this.coreCrypto.transaction(async (context) => {
      const preKeys: PreKeyCrypto[] = await Promise.all(
        Array.from({length: count}, async (__, index) => {
          const updatedIndex = from + index;
          const id = updatedIndex & 0xffff;
          const data = await context.proteusNewPrekey(id)

          return new PreKeyCrypto(id, Encoder.toBase64(data).asString);
        })
      )

      return preKeys
    })
  }

  async generateProteusLastPreKey(): Promise<PreKeyCrypto> {
    return await this.coreCrypto.transaction(async (context) => {
      const proteusLastPreKeyId = proteusLastResortPrekeyId()
      const proteusLastPreKeyValue = await context.proteusLastResortPrekey()

      return new PreKeyCrypto(
        proteusLastPreKeyId,
        Encoder.toBase64(proteusLastPreKeyValue).asString
      )
    })
  }

  async encryptMls(
    mlsGroupId: ConversationId,
    message: Uint8Array
  ): Promise<Uint8Array> {
    return await this.coreCrypto.transaction(async (context) => {
      return await context.encryptMessage(
        mlsGroupId,
        message
      )
    })
  }

  async decryptMls(
    mlsGroupId: ConversationId,
    encryptedMessageBytes: Uint8Array
  ): Promise<Uint8Array | undefined> {
    const decryptedMessage = await this.coreCrypto.transaction(async (context) => {
      return await context.decryptMessage(
        mlsGroupId,
        encryptedMessageBytes
      )
    })

    return decryptedMessage.message
  }

  async processWelcomeMessage(welcomeMessageBytes: Uint8Array) {
    await this.coreCrypto.transaction(async (context) => {
      await context.processWelcomeMessage(
        new Welcome(welcomeMessageBytes)
      )
    })
  }

  async hasTooFewKeyPackageCount(): Promise<boolean> {
    const packageCount = await this.coreCrypto.transaction(async (context) => {
      return (await context.getKeyPackages()).length
    })
    return packageCount < this.MLS_DEFAULT_KEYPACKAGE_COUNT / 2
  }

  async wipeConversation(mlsGroupId: ConversationId) {
    this.logger.debug("Conversation will be deleted from CoreCrypto. mlsGroupId: {}", obfuscateId(String(mlsGroupId)))
    await this.coreCrypto.transaction(async (context) => {
      await context.wipeConversation(mlsGroupId)
      this.logger.debug("Conversation is deleted from CoreCrypto. mlsGroupId: {}", obfuscateId(String(mlsGroupId)))
    })
  }

  async conversationExists(mlsGroupId: ConversationId): Promise<boolean> {
    return await this.coreCrypto.transaction(async (context) => {
      return await context.conversationExists(mlsGroupId)
    })
  }

  async conversationEpoch(mlsGroupId: ConversationId): Promise<bigint> {
    return await this.coreCrypto.transaction(async (context) => {
      return await context.conversationEpoch(mlsGroupId)
    })
  }

  async joinMlsConversation(groupInfo: GroupInfo): Promise<void> {
    await this.coreCrypto.transaction(async (context) => {
      await context.joinByExternalCommit(
        groupInfo,
        this.credential!
      )
    })
  }

  /**
   * Creates a conversation in CoreCrypto.
   *
   * @param ConversationId Group ID from creating the conversation on the backend
   * @param externalSenders Keys fetched from backend for validating external remove proposals
   */
  async createConversation(
    mlsGroupId: string,
    removalKey: Uint8Array
  ) {
    await this.coreCrypto.transaction(async (context) => {
      const mlsGroupIdBytes = Decoder.fromBase64(mlsGroupId).asBytes

      await context.createConversation(
        new ConversationId(mlsGroupIdBytes),
        this.credential!,
        ExternalSender.parse(
          removalKey,
          this.credential!.signatureScheme()
        )
      )
    })
  }

  async updateKeyingMaterial(mlsGroupId: string) {
    await this.coreCrypto.transaction(async (context) => {
      const mlsGroupIdBytes = Decoder.fromBase64(mlsGroupId).asBytes
      await context.updateKeyingMaterial(
        new ConversationId(mlsGroupIdBytes)
      )
    })
  }

  /**
   * Alternative way to add members (clients) to an MLS conversation.
   * Instead of creating a join request accepted by the new client,
   * this method directly adds members (clients) to a conversation.
   */
  async addClientsToMlsConversation(
    mlsGroupId: string,
    keyPackages: Uint8Array[]
  ) {
    await this.coreCrypto.transaction(async (context) => {
      const mlsGroupIdBytes = Decoder.fromBase64(mlsGroupId).asBytes
      await context.addClientsToConversation(
        new ConversationId(mlsGroupIdBytes),
        keyPackages.map((keyPackage) => new KeyPackage(keyPackage))
      )
    })
  }

  async removeClientsFromMlsConversation(
    mlsGroupId: string,
    cryptoClientIds: CryptoClientId[]
  ) {
    this.logger.debug(`Clients will be removed from the conversation in CoreCrypto. mlsGroupId: ${obfuscateId(mlsGroupId)}`)

    await this.coreCrypto.transaction(async (context) => {
      const mlsGroupIdBytes = Decoder.fromBase64(mlsGroupId).asBytes;
      const clientIds: ClientId[] = cryptoClientIds.map(
        (cryptoClientId: CryptoClientId) => new ClientId(
          new Uuid(cryptoClientId.userId),
          DeviceId.fromHexString(cryptoClientId.deviceId),
          cryptoClientId.userDomain
        )
      )

      await context.removeClientsFromConversation(
        new ConversationId(mlsGroupIdBytes),
        clientIds
      );

      this.logger.debug(`Clients are removed from the conversation in CoreCrypto. mlsGroupId: ${obfuscateId(mlsGroupId)}`)
    });
  }

  private PROTEUS_PREKEYS_FROM_COUNT: number = 0
  private PROTEUS_PREKEYS_MAX_COUNT: number = 10
  private MLS_DEFAULT_KEYPACKAGE_COUNT = 100
}
