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

import {beforeEach, describe, expect, it, vi} from 'vitest'
import {join} from 'node:path'
import {PreKeyCrypto} from '../../src/model/PreKeyCrypto.js'
import {QualifiedId} from '../../src/model/QualifiedId.js'

vi.mock('node:fs', () => ({
  rmSync: vi.fn()
}))

// ---------------------------------------------------------------------------
// Mock the native CoreCrypto module. CoreCryptoClient imports this directly
// (it isn't injected), so we replace the module rather than passing mocks
// into a constructor.
// ---------------------------------------------------------------------------
vi.mock('@wireapp/core-crypto/native', () => {
  const CipherSuite = {
    Mls128Dhkemx25519Aes128gcmSha256Ed25519: 'Mls128Dhkemx25519Aes128gcmSha256Ed25519',
    Mls128Dhkemp256Aes128gcmSha256P256: 'Mls128Dhkemp256Aes128gcmSha256P256',
    Mls128Dhkemx25519Chacha20poly1305Sha256Ed25519: 'Mls128Dhkemx25519Chacha20poly1305Sha256Ed25519',
    Mls256Dhkemx448Aes256gcmSha512Ed448: 'Mls256Dhkemx448Aes256gcmSha512Ed448',
    Mls256Dhkemp521Aes256gcmSha512P521: 'Mls256Dhkemp521Aes256gcmSha512P521',
    Mls256Dhkemx448Chacha20poly1305Sha512Ed448: 'Mls256Dhkemx448Chacha20poly1305Sha512Ed448',
    Mls256Dhkemp384Aes256gcmSha384P384: 'Mls256Dhkemp384Aes256gcmSha384P384'
  }

  class ClientId {
    constructor(
      public uuid: any,
      public deviceId: any,
      public domain: any
    ) {}
  }

  class ConversationId {
    constructor(public bytes: Uint8Array) {}
  }

  class DeviceId {
    hex: string

    constructor(hex: string) {
      this.hex = hex
    }

    static fromHexString = vi.fn((hex: string) => new DeviceId(hex))
  }

  class Uuid {
    constructor(public value: string) {}

    toString() {
      return this.value
    }
  }

  class Welcome {
    constructor(public bytes: Uint8Array) {}
  }

  class KeyPackage {
    constructor(public bytes: Uint8Array) {}
  }

  class DatabaseKey {
    constructor(public key: Uint8Array) {}
  }

  class Database {
    static open = vi.fn()
  }

  class Credential {
    static basic = vi.fn()
  }

  class ExternalSender {
    static parse = vi.fn()
  }

  class CoreCrypto {
    static new = vi.fn()
  }

  const proteusLastResortPrekeyId = vi.fn(() => 65535)
  const DecryptedMessage = {
    Text: {
      instanceOf: vi.fn((message: any) => message.tag === 'Text')
    },
    Commit: {
      instanceOf: vi.fn((message: any) => message.tag === 'Commit')
    },
    Proposal: {
      instanceOf: vi.fn((message: any) => message.tag === 'Proposal')
    }
  }

  return {
    CipherSuite,
    ClientId,
    ConversationId,
    CoreCrypto,
    Credential,
    CredentialRef: class {},
    Database,
    DatabaseKey,
    DecryptedMessage,
    DeviceId,
    ExternalSender,
    GroupInfo: class {},
    KeyPackage,
    proteusLastResortPrekeyId,
    Uuid,
    Welcome
  }
})

vi.mock('bazinga64', () => ({
  Encoder: {
    toBase64: vi.fn((bytes: Uint8Array) => ({asString: `base64(${Array.from(bytes ?? []).join(',')})`}))
  },
  Decoder: {
    fromBase64: vi.fn((_value: string) => ({asBytes: new Uint8Array([9, 9, 9])}))
  }
}))

vi.mock('../../src/utils/logger/LoggerFactory.js', () => ({
  LoggerFactory: {
    getLogger: vi.fn(() => ({debug: vi.fn(), info: vi.fn()}))
  }
}))

vi.mock('../../src/utils/ObfuscateUtil.js', () => ({
  obfuscateId: vi.fn((id: string) => `obfuscated(${id})`)
}))

vi.mock('../../src/utils/StoragePaths.js', () => ({
  CRYPTOGRAPHY_STORAGE_PATH: '/test/storage/path'
}))

import {CoreCryptoClient} from '../../src/core/CoreCryptoClient.js'
import {
  CipherSuite,
  CoreCrypto,
  Credential,
  Database,
  DeviceId,
  ExternalSender,
  Uuid
} from '@wireapp/core-crypto/native'
import {Decoder} from 'bazinga64'
import {rmSync} from 'node:fs'

describe('CoreCryptoClient', () => {
  const USER_ID = 'test-user-id'
  const STORAGE_KEY = new Uint8Array([1, 2, 3])
  let mockMlsTransport: any
  let mockContext: any
  let mockCoreCrypto: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockMlsTransport = {} as any

    mockContext = {
      mlsInit: vi.fn(),
      addCredential: vi.fn(),
      generateKeyPackage: vi.fn(),
      proteusInit: vi.fn(),
      proteusNewPrekey: vi.fn(),
      proteusLastResortPrekey: vi.fn(),
      encryptMessage: vi.fn(),
      decryptMessage: vi.fn(),
      processWelcomeMessage: vi.fn(),
      getKeyPackages: vi.fn(),
      wipeConversation: vi.fn(),
      conversationExists: vi.fn(),
      conversationEpoch: vi.fn(),
      joinByExternalCommit: vi.fn(),
      createConversation: vi.fn(),
      updateKeyingMaterial: vi.fn(),
      addClientsToConversation: vi.fn(),
      removeClientsFromConversation: vi.fn()
    }

    mockCoreCrypto = {
      transaction: vi.fn(async (callback: any) => callback(mockContext)),
      getCredentials: vi.fn(),
      publicKey: vi.fn()
    }

    vi.mocked(Database.open).mockResolvedValue({} as any)
    vi.mocked(CoreCrypto.new).mockReturnValue(mockCoreCrypto as any)
  })

  const createClient = async (ciphersuiteCode: number = 1) =>
    CoreCryptoClient.create(USER_ID, ciphersuiteCode, STORAGE_KEY, mockMlsTransport)

  // A credential the mocked Credential.basic() / context.addCredential() will hand back.
  const mockCredential = {signatureScheme: vi.fn(() => 'ed25519-scheme')}

  const createInitializedClient = async (ciphersuiteCode: number = 1, existingCredentials: any[] = []) => {
    const client = await createClient(ciphersuiteCode)
    vi.mocked(mockCoreCrypto.getCredentials).mockResolvedValue(existingCredentials)
    vi.mocked(Credential.basic).mockReturnValue({} as any)
    vi.mocked(mockContext.addCredential).mockResolvedValue(mockCredential)
    await client.initMlsClient({userId: USER_ID, deviceId: 'aabb', userDomain: 'wire.com'} as any)
    return client
  }

  describe('create', () => {
    it('should resolve the client storage path', () => {
      expect(CoreCryptoClient.clientStoragePath(USER_ID)).toBe(join('/test/storage/path', USER_ID))
    })

    it('should open the database at the correct path with the storage key', async () => {
      // given / when
      await createClient(1)

      // then
      expect(Database.open).toHaveBeenCalledWith(
        join('/test/storage/path', USER_ID),
        expect.objectContaining({key: STORAGE_KEY})
      )
    })

    it('should create a CoreCrypto instance from the opened database', async () => {
      // given
      const mockDb = {marker: 'db'}
      vi.mocked(Database.open).mockResolvedValue(mockDb as any)

      // when
      await createClient(1)

      // then
      expect(CoreCrypto.new).toHaveBeenCalledWith(mockDb)
    })

    it('should return a CoreCryptoClient instance', async () => {
      // when
      const client = await createClient(1)

      // then
      expect(client).toBeInstanceOf(CoreCryptoClient)
    })

    it('should delete the client storage path', () => {
      CoreCryptoClient.deleteClientStorage(USER_ID)

      expect(rmSync).toHaveBeenCalledWith(join('/test/storage/path', USER_ID), {recursive: true, force: true})
      expect(rmSync).toHaveBeenCalledWith(`${join('/test/storage/path', USER_ID)}-wal`, {
        recursive: true,
        force: true
      })
      expect(rmSync).toHaveBeenCalledWith(`${join('/test/storage/path', USER_ID)}-shm`, {
        recursive: true,
        force: true
      })
      expect(rmSync).toHaveBeenCalledTimes(3)
    })
  })

  describe('getMlsCiphersuiteName', () => {
    it.each([
      [1, CipherSuite.Mls128Dhkemx25519Aes128gcmSha256Ed25519],
      [2, CipherSuite.Mls128Dhkemp256Aes128gcmSha256P256],
      [3, CipherSuite.Mls128Dhkemx25519Chacha20poly1305Sha256Ed25519],
      [4, CipherSuite.Mls256Dhkemx448Aes256gcmSha512Ed448],
      [5, CipherSuite.Mls256Dhkemp521Aes256gcmSha512P521],
      [6, CipherSuite.Mls256Dhkemx448Chacha20poly1305Sha512Ed448],
      [7, CipherSuite.Mls256Dhkemp384Aes256gcmSha384P384]
    ])('should map code %i to the correct ciphersuite', (code, expected) => {
      expect(CoreCryptoClient.getMlsCiphersuiteName(code)).toBe(expected)
    })

    it('should fall back to the default ciphersuite for an unknown code', () => {
      expect(CoreCryptoClient.getMlsCiphersuiteName(999)).toBe(CipherSuite.Mls128Dhkemx25519Aes128gcmSha256Ed25519)
    })
  })

  describe('initMlsClient', () => {
    const cryptoClientId = {userId: USER_ID, deviceId: 'aabb', userDomain: 'wire.com'} as any

    it('should call mlsInit with the constructed clientId and mls transport', async () => {
      // given
      const client = await createClient(1)
      vi.mocked(mockCoreCrypto.getCredentials).mockResolvedValue([])
      vi.mocked(Credential.basic).mockReturnValue({} as any)
      vi.mocked(mockContext.addCredential).mockResolvedValue(mockCredential)

      // when
      await client.initMlsClient(cryptoClientId)

      // then
      expect(mockContext.mlsInit).toHaveBeenCalledWith(expect.anything(), mockMlsTransport)
    })

    it('should create a new credential when none exist', async () => {
      // given
      const client = await createClient(1)
      vi.mocked(mockCoreCrypto.getCredentials).mockResolvedValue([])
      vi.mocked(Credential.basic).mockReturnValue({marker: 'new-credential'} as any)
      vi.mocked(mockContext.addCredential).mockResolvedValue(mockCredential)

      // when
      await client.initMlsClient(cryptoClientId)

      // then
      expect(Credential.basic).toHaveBeenCalled()
      expect(mockContext.addCredential).toHaveBeenCalledWith({marker: 'new-credential'})
    })

    it('should reuse the first existing credential when one is already present', async () => {
      // given
      const client = await createClient(1)
      const existingCredential = {marker: 'existing'}
      vi.mocked(mockCoreCrypto.getCredentials).mockResolvedValue([existingCredential])

      // when
      await client.initMlsClient(cryptoClientId)

      // then
      expect(Credential.basic).not.toHaveBeenCalled()
      expect(mockContext.addCredential).not.toHaveBeenCalled()
    })
  })

  describe('mlsGenerateKeyPackages', () => {
    it('should generate the default number of key packages when no count is given', async () => {
      // given
      const client = await createInitializedClient()
      vi.mocked(mockContext.generateKeyPackage).mockImplementation(async () => ({
        serialize: () => new Uint8Array([1])
      }))

      // when
      const result = await client.mlsGenerateKeyPackages()

      // then
      expect(mockContext.generateKeyPackage).toHaveBeenCalledTimes(100)
      expect(result).toHaveLength(100)
    })

    it('should generate the requested number of key packages', async () => {
      // given
      const client = await createInitializedClient()
      vi.mocked(mockContext.generateKeyPackage).mockImplementation(async () => ({
        serialize: () => new Uint8Array([2])
      }))

      // when
      const result = await client.mlsGenerateKeyPackages(3)

      // then
      expect(mockContext.generateKeyPackage).toHaveBeenCalledTimes(3)
      expect(result).toHaveLength(3)
    })

    it('should generate key packages using the stored credential', async () => {
      // given
      const client = await createInitializedClient()
      vi.mocked(mockContext.generateKeyPackage).mockResolvedValue({serialize: () => new Uint8Array()})

      // when
      await client.mlsGenerateKeyPackages(1)

      // then
      expect(mockContext.generateKeyPackage).toHaveBeenCalledWith(mockCredential)
    })
  })

  describe('getMlsPublicKey', () => {
    it('should return ecdsa_secp256r1_sha256 for the P256 ciphersuite', async () => {
      // given
      const client = await createInitializedClient(2)
      vi.mocked(mockCoreCrypto.publicKey).mockResolvedValue(new Uint8Array([1]))

      // when
      const result = await client.getMlsPublicKey()

      // then
      expect(result).toHaveProperty('ecdsa_secp256r1_sha256')
    })

    it('should return ecdsa_secp384r1_sha384 for the P384 ciphersuite', async () => {
      // given
      const client = await createInitializedClient(7)
      vi.mocked(mockCoreCrypto.publicKey).mockResolvedValue(new Uint8Array([1]))

      // when
      const result = await client.getMlsPublicKey()

      // then
      expect(result).toHaveProperty('ecdsa_secp384r1_sha384')
    })

    it('should return ecdsa_secp521r1_sha512 for the P521 ciphersuite', async () => {
      // given
      const client = await createInitializedClient(5)
      vi.mocked(mockCoreCrypto.publicKey).mockResolvedValue(new Uint8Array([1]))

      // when
      const result = await client.getMlsPublicKey()

      // then
      expect(result).toHaveProperty('ecdsa_secp521r1_sha512')
    })

    it.each([1, 3])('should return ed25519 for ciphersuite code %i', async (code) => {
      // given
      const client = await createInitializedClient(code)
      vi.mocked(mockCoreCrypto.publicKey).mockResolvedValue(new Uint8Array([1]))

      // when
      const result = await client.getMlsPublicKey()

      // then
      expect(result).toHaveProperty('ed25519')
    })

    it.each([4, 6])('should throw for unsupported Ed448 ciphersuite code %i', async (code) => {
      // given
      const client = await createInitializedClient(code)
      vi.mocked(mockCoreCrypto.publicKey).mockResolvedValue(new Uint8Array([1]))

      // when / then
      await expect(client.getMlsPublicKey()).rejects.toThrow('Unsupported ciphersuite')
    })

    it('should request the public key using the stored credential', async () => {
      // given
      const client = await createInitializedClient(1)
      vi.mocked(mockCoreCrypto.publicKey).mockResolvedValue(new Uint8Array([1]))

      // when
      await client.getMlsPublicKey()

      // then
      expect(mockCoreCrypto.publicKey).toHaveBeenCalledWith(mockCredential)
    })
  })

  describe('initProteusClient', () => {
    it('should call proteusInit', async () => {
      // given
      const client = await createClient(1)

      // when
      await client.initProteusClient()

      // then
      expect(mockContext.proteusInit).toHaveBeenCalled()
    })
  })

  describe('generateProteusPreKeys', () => {
    it('should generate the default number of prekeys starting from the default offset', async () => {
      // given
      const client = await createClient(1)
      vi.mocked(mockContext.proteusNewPrekey).mockResolvedValue(new Uint8Array([1]))

      // when
      const result = await client.generateProteusPreKeys()

      // then
      expect(mockContext.proteusNewPrekey).toHaveBeenCalledTimes(10)
      expect(mockContext.proteusNewPrekey).toHaveBeenCalledWith(0)
      expect(mockContext.proteusNewPrekey).toHaveBeenCalledWith(9)
      expect(result).toHaveLength(10)
      expect(result[0]).toBeInstanceOf(PreKeyCrypto)
    })

    it('should generate prekeys using the given from/count range', async () => {
      // given
      const client = await createClient(1)
      vi.mocked(mockContext.proteusNewPrekey).mockResolvedValue(new Uint8Array([1]))

      // when
      const result = await client.generateProteusPreKeys(100, 3)

      // then
      expect(mockContext.proteusNewPrekey).toHaveBeenCalledWith(100)
      expect(mockContext.proteusNewPrekey).toHaveBeenCalledWith(101)
      expect(mockContext.proteusNewPrekey).toHaveBeenCalledWith(102)
      expect(result).toHaveLength(3)
    })

    it('should mask prekey ids to 16 bits', async () => {
      // given
      const client = await createClient(1)
      vi.mocked(mockContext.proteusNewPrekey).mockResolvedValue(new Uint8Array([1]))

      // when
      await client.generateProteusPreKeys(0x10000, 1)

      // then
      expect(mockContext.proteusNewPrekey).toHaveBeenCalledWith(0)
    })
  })

  describe('generateProteusLastPreKey', () => {
    it('should return a PreKeyCrypto using the reserved last-resort id', async () => {
      // given
      const client = await createClient(1)
      vi.mocked(mockContext.proteusLastResortPrekey).mockResolvedValue(new Uint8Array([7]))

      // when
      const result = await client.generateProteusLastPreKey()

      // then
      expect(result).toBeInstanceOf(PreKeyCrypto)
      expect(result.id).toBe(65535)
    })
  })

  describe('encryptMls', () => {
    it('should encrypt the message via the transaction context', async () => {
      // given
      const client = await createClient(1)
      const groupId = {} as any
      const message = new Uint8Array([1, 2])
      const encrypted = new Uint8Array([9, 9])
      vi.mocked(mockContext.encryptMessage).mockResolvedValue(encrypted)

      // when
      const result = await client.encryptMls(groupId, message)

      // then
      expect(mockContext.encryptMessage).toHaveBeenCalledWith(groupId, message)
      expect(result).toBe(encrypted)
    })
  })

  describe('decryptMls', () => {
    it('should return the decrypted message payload', async () => {
      // given
      const client = await createClient(1)
      const groupId = {} as any
      const encryptedBytes = new Uint8Array([1, 2])
      const decrypted = new Uint8Array([3, 4])
      const senderClientId = {
        deserialize: vi.fn(() => ({
          userId: new Uuid('sender-user-id'),
          deviceId: DeviceId.fromHexString('aabbccdd'),
          domain: 'wire.com'
        }))
      }
      vi.mocked(mockContext.decryptMessage).mockResolvedValue({
        tag: 'Text',
        inner: {plaintext: decrypted, senderClientId}
      })

      // when
      const result = await client.decryptMls(groupId, encryptedBytes)

      // then
      expect(mockContext.decryptMessage).toHaveBeenCalledWith(groupId, encryptedBytes)
      expect(senderClientId.deserialize).toHaveBeenCalledTimes(1)
      expect(result).toStrictEqual({
        plaintext: decrypted,
        sender: new QualifiedId('sender-user-id', 'wire.com')
      })
    })

    it('should return undefined when the decrypted message has no payload', async () => {
      // given
      const client = await createClient(1)
      vi.mocked(mockContext.decryptMessage).mockResolvedValue({tag: 'Commit', inner: {isActive: true}})

      // when
      const result = await client.decryptMls({} as any, new Uint8Array())

      // then
      expect(result).toBeUndefined()
    })
  })

  describe('processWelcomeMessage', () => {
    it('should process the welcome message via the transaction context', async () => {
      // given
      const client = await createClient(1)
      const welcomeBytes = new Uint8Array([5, 6])

      // when
      await client.processWelcomeMessage(welcomeBytes)

      // then
      expect(mockContext.processWelcomeMessage).toHaveBeenCalledWith(expect.objectContaining({bytes: welcomeBytes}))
    })
  })

  describe('hasTooFewKeyPackageCount', () => {
    it('should return true when the key package count is below half the default', async () => {
      // given
      const client = await createClient(1)
      vi.mocked(mockContext.getKeyPackages).mockResolvedValue(new Array(49).fill({}))

      // when
      const result = await client.hasTooFewKeyPackageCount()

      // then
      expect(result).toBe(true)
    })

    it('should return false when the key package count is at or above half the default', async () => {
      // given
      const client = await createClient(1)
      vi.mocked(mockContext.getKeyPackages).mockResolvedValue(new Array(50).fill({}))

      // when
      const result = await client.hasTooFewKeyPackageCount()

      // then
      expect(result).toBe(false)
    })
  })

  describe('wipeConversation', () => {
    it('should wipe the conversation via the transaction context', async () => {
      // given
      const client = await createClient(1)
      const groupId = {} as any

      // when
      await client.wipeConversation(groupId)

      // then
      expect(mockContext.wipeConversation).toHaveBeenCalledWith(groupId)
    })
  })

  describe('conversationExists', () => {
    it('should return the value from the transaction context', async () => {
      // given
      const client = await createClient(1)
      const groupId = {} as any
      vi.mocked(mockContext.conversationExists).mockResolvedValue(true)

      // when
      const result = await client.conversationExists(groupId)

      // then
      expect(mockContext.conversationExists).toHaveBeenCalledWith(groupId)
      expect(result).toBe(true)
    })
  })

  describe('conversationEpoch', () => {
    it('should return the epoch from the transaction context', async () => {
      // given
      const client = await createClient(1)
      const groupId = {} as any
      vi.mocked(mockContext.conversationEpoch).mockResolvedValue(42n)

      // when
      const result = await client.conversationEpoch(groupId)

      // then
      expect(mockContext.conversationEpoch).toHaveBeenCalledWith(groupId)
      expect(result).toBe(42n)
    })
  })

  describe('joinMlsConversation', () => {
    it('should join by external commit using the stored credential', async () => {
      // given
      const client = await createInitializedClient()
      const groupInfo = {} as any

      // when
      await client.joinMlsConversation(groupInfo)

      // then
      expect(mockContext.joinByExternalCommit).toHaveBeenCalledWith(groupInfo, mockCredential)
    })
  })

  describe('createConversation', () => {
    it('should decode the base64 group id and create the conversation with an external sender', async () => {
      // given
      const client = await createInitializedClient()
      const removalKey = new Uint8Array([1, 2, 3])
      vi.mocked(ExternalSender.parse).mockReturnValue({marker: 'external-sender'} as any)

      // when
      await client.createConversation('bWxzLWdyb3VwLWlk', removalKey)

      // then
      expect(Decoder.fromBase64).toHaveBeenCalledWith('bWxzLWdyb3VwLWlk')
      expect(ExternalSender.parse).toHaveBeenCalledWith(removalKey, 'ed25519-scheme')
      expect(mockContext.createConversation).toHaveBeenCalledWith(
        expect.objectContaining({bytes: new Uint8Array([9, 9, 9])}),
        mockCredential,
        {marker: 'external-sender'}
      )
    })
  })

  describe('updateKeyingMaterial', () => {
    it('should update the keying material for the decoded group id', async () => {
      // given
      const client = await createClient(1)

      // when
      await client.updateKeyingMaterial('bWxzLWdyb3VwLWlk')

      // then
      expect(mockContext.updateKeyingMaterial).toHaveBeenCalledWith(
        expect.objectContaining({bytes: new Uint8Array([9, 9, 9])})
      )
    })
  })

  describe('addClientsToMlsConversation', () => {
    it('should add wrapped key packages to the decoded group id', async () => {
      // given
      const client = await createClient(1)
      const keyPackages = [new Uint8Array([1]), new Uint8Array([2])]

      // when
      await client.addClientsToMlsConversation('bWxzLWdyb3VwLWlk', keyPackages)

      // then
      expect(mockContext.addClientsToConversation).toHaveBeenCalledWith(
        expect.objectContaining({bytes: new Uint8Array([9, 9, 9])}),
        [expect.objectContaining({bytes: keyPackages[0]}), expect.objectContaining({bytes: keyPackages[1]})]
      )
    })
  })

  describe('removeClientsFromMlsConversation', () => {
    it('should map crypto client ids and remove them from the decoded group id', async () => {
      // given
      const client = await createClient(1)
      const cryptoClientIds = [
        {userId: 'user-1', deviceId: 'aabb', userDomain: 'wire.com'},
        {userId: 'user-2', deviceId: 'ccdd', userDomain: 'wire.com'}
      ] as any

      // when
      await client.removeClientsFromMlsConversation('bWxzLWdyb3VwLWlk', cryptoClientIds)

      // then
      expect(mockContext.removeClientsFromConversation).toHaveBeenCalledWith(
        expect.objectContaining({bytes: new Uint8Array([9, 9, 9])}),
        [
          expect.objectContaining({uuid: expect.objectContaining({value: 'user-1'}), domain: 'wire.com'}),
          expect.objectContaining({uuid: expect.objectContaining({value: 'user-2'}), domain: 'wire.com'})
        ]
      )
    })
  })
})
