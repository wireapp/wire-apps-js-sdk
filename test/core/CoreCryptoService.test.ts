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
import {CoreCryptoService} from '../../src/core/CoreCryptoService.js'
import {CoreCryptoClient} from '../../src/core/CoreCryptoClient.js'
import {CoreCryptoError, MlsError} from '@wireapp/core-crypto/native'
import {Decoder} from 'bazinga64'
import {CryptoClientId} from '../../src/model/CryptoClientId.js'
import {QualifiedId} from '../../src/model/QualifiedId.js'

// ---------------------------------------------------------------------------
// CoreCryptoService builds its own CoreCryptoClient internally (via the
// static `create` factory) rather than receiving one through DI, so we mock
// the module instead of passing a mock into the constructor.
// ---------------------------------------------------------------------------
vi.mock('../../src/core/CoreCryptoClient.js', () => ({
  CoreCryptoClient: {
    create: vi.fn(),
    getMlsCiphersuiteName: vi.fn()
  }
}))

vi.mock('@wireapp/core-crypto/native', () => {
  class ConversationId {
    constructor(public bytes: Uint8Array) {}
  }

  class GroupInfo {
    constructor(public bytes: Uint8Array) {}
  }

  const CoreCryptoError = {
    Mls: {instanceOf: vi.fn(() => false)}
  }
  const MlsError = {
    OrphanWelcome: {instanceOf: vi.fn(() => false)},
    ConversationAlreadyExists: {instanceOf: vi.fn(() => false)}
  }
  return {ConversationId, GroupInfo, CoreCryptoError, MlsError}
})

vi.mock('bazinga64', () => ({
  Decoder: {
    fromBase64: vi.fn((value: string) => ({asBytes: new TextEncoder().encode(value)}))
  }
}))

vi.mock('../../src/model/CryptoClientId.js', () => ({
  CryptoClientId: {
    create: vi.fn((userId: string, deviceId: string, userDomain: string) => ({userId, deviceId, userDomain}))
  }
}))

vi.mock('../../src/utils/logger/LoggerFactory.js', () => ({
  LoggerFactory: {
    getLogger: vi.fn(() => ({debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()}))
  }
}))

vi.mock('../../src/utils/ObfuscateUtil.js', () => ({
  obfuscateId: vi.fn((id: string) => `obfuscated(${id})`),
  obfuscateClientId: vi.fn((id: string) => `obfuscatedClient(${id})`)
}))

describe('CoreCryptoService', () => {
  const WIRE_USER_ID = 'wire-user-id'
  const WIRE_USER_DOMAIN = 'wire.com'
  const STORAGE_KEY = new Uint8Array([1, 2, 3])
  const DEFAULT_CIPHERSUITE_CODE = 1

  let mockFeatureConfigsService: any
  let mockClientsService: any
  let mockMlsService: any
  let mockMlsTransport: any
  let mockAppProperties: any
  let mockCoreCryptoClientInstance: any
  let service: CoreCryptoService

  beforeEach(async () => {
    vi.clearAllMocks()

    mockFeatureConfigsService = {
      getDefaultCipherSuite: vi.fn().mockResolvedValue(DEFAULT_CIPHERSUITE_CODE)
    }

    mockClientsService = {
      registerClient: vi.fn(),
      updateClientWithMlsPublicKey: vi.fn()
    }

    mockMlsService = {
      uploadMlsKeyPackages: vi.fn(),
      claimKeyPackages: vi.fn(),
      getRemovalKey: vi.fn()
    }

    mockMlsTransport = {}

    mockAppProperties = {
      hasDeviceId: vi.fn(),
      getDeviceId: vi.fn(),
      setDeviceId: vi.fn(),
      setShouldRejoinConversations: vi.fn(),
      getApplicationQualifiedId: vi.fn().mockReturnValue(new QualifiedId(WIRE_USER_ID, WIRE_USER_DOMAIN))
    }

    mockCoreCryptoClientInstance = {
      initMlsClient: vi.fn(),
      initProteusClient: vi.fn(),
      generateProteusPreKeys: vi.fn(),
      generateProteusLastPreKey: vi.fn(),
      getMlsPublicKey: vi.fn(),
      mlsGenerateKeyPackages: vi.fn(),
      processWelcomeMessage: vi.fn(),
      hasTooFewKeyPackageCount: vi.fn(),
      encryptMls: vi.fn(),
      decryptMls: vi.fn(),
      wipeConversation: vi.fn(),
      conversationExists: vi.fn(),
      conversationEpoch: vi.fn(),
      joinMlsConversation: vi.fn(),
      updateKeyingMaterial: vi.fn(),
      addClientsToMlsConversation: vi.fn(),
      removeClientsFromMlsConversation: vi.fn(),
      createConversation: vi.fn()
    }

    vi.mocked(CoreCryptoClient.create).mockResolvedValue(mockCoreCryptoClientInstance)
    vi.mocked(CoreCryptoClient.getMlsCiphersuiteName).mockReturnValue('mock-ciphersuite' as any)

    service = new CoreCryptoService(
      STORAGE_KEY,
      mockFeatureConfigsService,
      mockClientsService,
      mockMlsService,
      mockMlsTransport,
      mockAppProperties
    )
  })

  const initService = async () => {
    await service.initCoreCryptoClient()
  }

  describe('initCoreCryptoClient', () => {
    it('should fetch the default ciphersuite and create the CoreCryptoClient with it', async () => {
      // when
      await initService()

      // then
      expect(mockFeatureConfigsService.getDefaultCipherSuite).toHaveBeenCalled()
      expect(CoreCryptoClient.create).toHaveBeenCalledWith(
        WIRE_USER_ID,
        DEFAULT_CIPHERSUITE_CODE,
        STORAGE_KEY,
        mockMlsTransport
      )
    })

    it('should wire subsequent calls to the created CoreCryptoClient instance', async () => {
      // given
      await initService()
      vi.mocked(mockCoreCryptoClientInstance.hasTooFewKeyPackageCount).mockResolvedValue(true)

      // when
      const result = await service.hasTooFewKeyPackageCount()

      // then
      expect(result).toBe(true)
    })
  })

  describe('initOrRegisterClient', () => {
    it('should throw when called before initCoreCryptoClient', async () => {
      // when / then
      await expect(service.initOrRegisterClient()).rejects.toThrow('CoreCryptoClient is not initialized.')
    })

    describe('when a device is already registered', () => {
      const STORED_DEVICE_ID = 'stored-device-id'

      beforeEach(async () => {
        await initService()
        vi.mocked(mockAppProperties.hasDeviceId).mockReturnValue(true)
        vi.mocked(mockAppProperties.getDeviceId).mockReturnValue(STORED_DEVICE_ID)
      })

      it('should init the MLS client with the stored device id', async () => {
        // when
        await service.initOrRegisterClient()

        // then
        expect(CryptoClientId.create).toHaveBeenCalledWith(WIRE_USER_ID, STORED_DEVICE_ID, WIRE_USER_DOMAIN)
        expect(mockCoreCryptoClientInstance.initMlsClient).toHaveBeenCalledWith({
          userId: WIRE_USER_ID,
          deviceId: STORED_DEVICE_ID,
          userDomain: WIRE_USER_DOMAIN
        })
      })

      it('should mark rejoin conversations as not needed', async () => {
        // when
        await service.initOrRegisterClient()

        // then
        expect(mockAppProperties.setShouldRejoinConversations).toHaveBeenCalledWith(false)
      })

      it('should not attempt to register a new client', async () => {
        // when
        await service.initOrRegisterClient()

        // then
        expect(mockClientsService.registerClient).not.toHaveBeenCalled()
      })
    })

    describe('when no device is registered yet', () => {
      const REGISTERED_DEVICE_ID = 'new-device-id'
      const preKeys = [{id: 1, key: 'prekey-1'}]
      const lastPreKey = {id: 65535, key: 'last-prekey'}

      beforeEach(async () => {
        await initService()
        vi.mocked(mockAppProperties.hasDeviceId).mockReturnValue(false)
        vi.mocked(mockCoreCryptoClientInstance.generateProteusPreKeys).mockResolvedValue(preKeys)
        vi.mocked(mockCoreCryptoClientInstance.generateProteusLastPreKey).mockResolvedValue(lastPreKey)
        vi.mocked(mockClientsService.registerClient).mockResolvedValue(REGISTERED_DEVICE_ID)
        vi.mocked(mockCoreCryptoClientInstance.getMlsPublicKey).mockResolvedValue({ed25519: 'key'})
        vi.mocked(mockCoreCryptoClientInstance.mlsGenerateKeyPackages).mockResolvedValue([new Uint8Array([1])])
      })

      it('should initialize the proteus client and generate prekeys', async () => {
        // when
        await service.initOrRegisterClient()

        // then
        expect(mockCoreCryptoClientInstance.initProteusClient).toHaveBeenCalled()
        expect(mockCoreCryptoClientInstance.generateProteusPreKeys).toHaveBeenCalled()
        expect(mockCoreCryptoClientInstance.generateProteusLastPreKey).toHaveBeenCalled()
      })

      it('should register the client with the generated prekeys', async () => {
        // when
        await service.initOrRegisterClient()

        // then
        expect(mockClientsService.registerClient).toHaveBeenCalledWith(preKeys, lastPreKey)
      })

      it('should store the registered device id and init the MLS client with it', async () => {
        // when
        await service.initOrRegisterClient()

        // then
        expect(mockAppProperties.setDeviceId).toHaveBeenCalledWith(REGISTERED_DEVICE_ID)
        expect(CryptoClientId.create).toHaveBeenCalledWith(WIRE_USER_ID, REGISTERED_DEVICE_ID, WIRE_USER_DOMAIN)
        expect(mockCoreCryptoClientInstance.initMlsClient).toHaveBeenCalledWith({
          userId: WIRE_USER_ID,
          deviceId: REGISTERED_DEVICE_ID,
          userDomain: WIRE_USER_DOMAIN
        })
      })

      it('should upload the MLS public key and key packages', async () => {
        // when
        await service.initOrRegisterClient()

        // then
        expect(mockCoreCryptoClientInstance.getMlsPublicKey).toHaveBeenCalled()
        expect(mockClientsService.updateClientWithMlsPublicKey).toHaveBeenCalledWith({ed25519: 'key'})
        expect(mockCoreCryptoClientInstance.mlsGenerateKeyPackages).toHaveBeenCalled()
        expect(mockMlsService.uploadMlsKeyPackages).toHaveBeenCalledWith([new Uint8Array([1])])
      })

      it('should mark rejoin conversations as needed', async () => {
        // when
        await service.initOrRegisterClient()

        // then
        expect(mockAppProperties.setShouldRejoinConversations).toHaveBeenCalledWith(true)
      })

      it('should wrap and rethrow when client registration fails, without storing a device id', async () => {
        // given
        vi.mocked(mockClientsService.registerClient).mockRejectedValue(new Error('network down'))

        // when / then
        await expect(service.initOrRegisterClient()).rejects.toThrow('Error when registering client')

        expect(mockAppProperties.setDeviceId).not.toHaveBeenCalled()
        expect(mockCoreCryptoClientInstance.initMlsClient).not.toHaveBeenCalled()
      })
    })
  })

  describe('processWelcomeMessage', () => {
    const welcomeBytes = new Uint8Array([1, 2])
    const groupInfoBytes = new Uint8Array([3, 4])

    beforeEach(async () => {
      await initService()
    })

    it('should process the welcome message and do nothing else on success', async () => {
      // when
      await service.processWelcomeMessage(welcomeBytes, groupInfoBytes)

      // then
      expect(mockCoreCryptoClientInstance.processWelcomeMessage).toHaveBeenCalledWith(welcomeBytes)
      expect(mockCoreCryptoClientInstance.joinMlsConversation).not.toHaveBeenCalled()
    })

    it('should join the conversation when the welcome message is orphaned', async () => {
      // given
      const orphanError = new Error('orphan') as any
      orphanError.inner = {mlsError: 'orphan-inner'}
      vi.mocked(mockCoreCryptoClientInstance.processWelcomeMessage).mockRejectedValue(orphanError)
      vi.mocked(CoreCryptoError.Mls.instanceOf).mockReturnValue(true)
      vi.mocked(MlsError.OrphanWelcome.instanceOf).mockReturnValue(true)

      // when
      await service.processWelcomeMessage(welcomeBytes, groupInfoBytes)

      // then
      expect(mockCoreCryptoClientInstance.joinMlsConversation).toHaveBeenCalledWith(
        expect.objectContaining({bytes: groupInfoBytes})
      )
    })

    it('should swallow other errors without joining the conversation', async () => {
      // given
      vi.mocked(mockCoreCryptoClientInstance.processWelcomeMessage).mockRejectedValue(new Error('boom'))
      vi.mocked(CoreCryptoError.Mls.instanceOf).mockReturnValue(false)

      // when / then
      await expect(service.processWelcomeMessage(welcomeBytes, groupInfoBytes)).resolves.toBeUndefined()
      expect(mockCoreCryptoClientInstance.joinMlsConversation).not.toHaveBeenCalled()
    })
  })

  describe('hasTooFewKeyPackageCount', () => {
    it('should delegate to the CoreCryptoClient', async () => {
      // given
      await initService()
      vi.mocked(mockCoreCryptoClientInstance.hasTooFewKeyPackageCount).mockResolvedValue(false)

      // when
      const result = await service.hasTooFewKeyPackageCount()

      // then
      expect(result).toBe(false)
    })
  })

  describe('mlsGenerateKeyPackages', () => {
    it('should delegate to the CoreCryptoClient', async () => {
      // given
      await initService()
      const keyPackages = [new Uint8Array([1])]
      vi.mocked(mockCoreCryptoClientInstance.mlsGenerateKeyPackages).mockResolvedValue(keyPackages)

      // when
      const result = await service.mlsGenerateKeyPackages()

      // then
      expect(result).toBe(keyPackages)
    })
  })

  describe('encryptMls', () => {
    it('should decode the group id and encrypt via the CoreCryptoClient', async () => {
      // given
      await initService()
      const message = new Uint8Array([9])
      const encrypted = new Uint8Array([10])
      vi.mocked(mockCoreCryptoClientInstance.encryptMls).mockResolvedValue(encrypted)

      // when
      const result = await service.encryptMls('group-id', message)

      // then
      expect(Decoder.fromBase64).toHaveBeenCalledWith('group-id')
      expect(mockCoreCryptoClientInstance.encryptMls).toHaveBeenCalledWith(
        expect.objectContaining({bytes: new TextEncoder().encode('group-id')}),
        message
      )
      expect(result).toBe(encrypted)
    })
  })

  describe('decryptMls', () => {
    it('should decode both the group id and the message and decrypt via the CoreCryptoClient', async () => {
      // given
      await initService()
      const decrypted = new Uint8Array([11])
      vi.mocked(mockCoreCryptoClientInstance.decryptMls).mockResolvedValue(decrypted)

      // when
      const result = await service.decryptMls('group-id', 'encrypted-message')

      // then
      expect(Decoder.fromBase64).toHaveBeenCalledWith('group-id')
      expect(Decoder.fromBase64).toHaveBeenCalledWith('encrypted-message')
      expect(mockCoreCryptoClientInstance.decryptMls).toHaveBeenCalledWith(
        expect.objectContaining({bytes: new TextEncoder().encode('group-id')}),
        new TextEncoder().encode('encrypted-message')
      )
      expect(result).toBe(decrypted)
    })
  })

  describe('wipeConversation', () => {
    it('should decode the group id and wipe via the CoreCryptoClient', async () => {
      // given
      await initService()

      // when
      await service.wipeConversation('group-id')

      // then
      expect(mockCoreCryptoClientInstance.wipeConversation).toHaveBeenCalledWith(
        expect.objectContaining({bytes: new TextEncoder().encode('group-id')})
      )
    })
  })

  describe('conversationExists', () => {
    it('should decode the group id and check existence via the CoreCryptoClient', async () => {
      // given
      await initService()
      vi.mocked(mockCoreCryptoClientInstance.conversationExists).mockResolvedValue(true)

      // when
      const result = await service.conversationExists('group-id')

      // then
      expect(mockCoreCryptoClientInstance.conversationExists).toHaveBeenCalledWith(
        expect.objectContaining({bytes: new TextEncoder().encode('group-id')})
      )
      expect(result).toBe(true)
    })
  })

  describe('conversationEpoch', () => {
    it('should decode the group id and return the epoch from the CoreCryptoClient', async () => {
      // given
      await initService()
      vi.mocked(mockCoreCryptoClientInstance.conversationEpoch).mockResolvedValue(3n)

      // when
      const result = await service.conversationEpoch('group-id')

      // then
      expect(mockCoreCryptoClientInstance.conversationEpoch).toHaveBeenCalledWith(
        expect.objectContaining({bytes: new TextEncoder().encode('group-id')})
      )
      expect(result).toBe(3n)
    })
  })

  describe('joinMlsConversation', () => {
    it('should wrap the bytes in a GroupInfo and join via the CoreCryptoClient', async () => {
      // given
      await initService()
      const groupInfoBytes = new Uint8Array([5, 6])

      // when
      await service.joinMlsConversation(groupInfoBytes)

      // then
      expect(mockCoreCryptoClientInstance.joinMlsConversation).toHaveBeenCalledWith(
        expect.objectContaining({bytes: groupInfoBytes})
      )
    })
  })

  describe('addClientsToMlsConversation', () => {
    const MEMBERS = [{id: 'user-1', domain: 'wire.com'}] as any

    beforeEach(async () => {
      await initService()
    })

    it('should throw when the members list is empty', async () => {
      // when / then
      await expect(service.addClientsToMlsConversation('group-id', [])).rejects.toThrow(
        'List of members cannot be empty.'
      )
      expect(mockMlsService.claimKeyPackages).not.toHaveBeenCalled()
    })

    it('should update keying material instead of adding clients when no key packages were claimed', async () => {
      // given
      vi.mocked(mockMlsService.claimKeyPackages).mockResolvedValue({
        keyPackages: [],
        successUsers: [],
        failedUsers: MEMBERS
      })

      // when
      const result = await service.addClientsToMlsConversation('group-id', MEMBERS)

      // then
      expect(mockMlsService.claimKeyPackages).toHaveBeenCalledWith(MEMBERS, DEFAULT_CIPHERSUITE_CODE)
      expect(mockCoreCryptoClientInstance.updateKeyingMaterial).toHaveBeenCalledWith('group-id')
      expect(mockCoreCryptoClientInstance.addClientsToMlsConversation).not.toHaveBeenCalled()
      expect(result).toEqual({membersAdded: [], membersFailedToAdd: MEMBERS})
    })

    it('should add clients to the MLS conversation when key packages were claimed', async () => {
      // given
      const keyPackages = [new Uint8Array([1])]
      vi.mocked(mockMlsService.claimKeyPackages).mockResolvedValue({
        keyPackages,
        successUsers: MEMBERS,
        failedUsers: []
      })

      // when
      const result = await service.addClientsToMlsConversation('group-id', MEMBERS)

      // then
      expect(mockCoreCryptoClientInstance.addClientsToMlsConversation).toHaveBeenCalledWith('group-id', keyPackages)
      expect(mockCoreCryptoClientInstance.updateKeyingMaterial).not.toHaveBeenCalled()
      expect(result).toEqual({membersAdded: MEMBERS, membersFailedToAdd: []})
    })
  })

  describe('removeClientsFromMlsConversation', () => {
    it('should delegate to the CoreCryptoClient with the given group id and client ids', async () => {
      // given
      await initService()
      const clientIds = [{userId: 'user-1', deviceId: 'aabb', userDomain: 'wire.com'}] as any

      // when
      await service.removeClientsFromMlsConversation('group-id', clientIds)

      // then
      expect(mockCoreCryptoClientInstance.removeClientsFromMlsConversation).toHaveBeenCalledWith('group-id', clientIds)
    })
  })

  describe('establishMlsConversation', () => {
    beforeEach(async () => {
      await initService()
    })

    it('should throw when mlsGroupId is missing', async () => {
      // when / then
      await expect(service.establishMlsConversation('')).rejects.toThrow(
        'mlsGroupId is required to establish an MLS conversation.'
      )
      expect(mockMlsService.getRemovalKey).not.toHaveBeenCalled()
    })

    it('should throw when no removal key is found', async () => {
      // given
      vi.mocked(mockMlsService.getRemovalKey).mockResolvedValue(null)

      // when / then
      await expect(service.establishMlsConversation('group-id')).rejects.toThrow(
        'No Public Keys found, skipping creating a conversation.'
      )
      expect(mockCoreCryptoClientInstance.createConversation).not.toHaveBeenCalled()
    })

    it('should create the conversation using the resolved ciphersuite and removal key', async () => {
      // given
      const removalKey = new Uint8Array([7, 8])
      const mlsPublicKeysResponse = {marker: 'public-keys'} as any
      vi.mocked(mockMlsService.getRemovalKey).mockResolvedValue(removalKey)

      // when
      await service.establishMlsConversation('group-id', mlsPublicKeysResponse)

      // then
      expect(CoreCryptoClient.getMlsCiphersuiteName).toHaveBeenCalledWith(DEFAULT_CIPHERSUITE_CODE)
      expect(mockMlsService.getRemovalKey).toHaveBeenCalledWith('mock-ciphersuite', mlsPublicKeysResponse)
      expect(mockCoreCryptoClientInstance.createConversation).toHaveBeenCalledWith('group-id', removalKey)
    })

    it('should rethrow a friendly error when the conversation already exists', async () => {
      // given
      const removalKey = new Uint8Array([7, 8])
      vi.mocked(mockMlsService.getRemovalKey).mockResolvedValue(removalKey)
      const alreadyExistsError = new Error('already exists') as any
      alreadyExistsError.inner = {mlsError: 'already-exists-inner'}
      vi.mocked(mockCoreCryptoClientInstance.createConversation).mockRejectedValue(alreadyExistsError)
      vi.mocked(CoreCryptoError.Mls.instanceOf).mockReturnValue(true)
      vi.mocked(MlsError.ConversationAlreadyExists.instanceOf).mockReturnValue(true)

      // when / then
      await expect(service.establishMlsConversation('group-id')).rejects.toThrow('Conversation already exists.')
    })

    it('should swallow other creation errors without throwing', async () => {
      // given
      const removalKey = new Uint8Array([7, 8])
      vi.mocked(mockMlsService.getRemovalKey).mockResolvedValue(removalKey)
      vi.mocked(mockCoreCryptoClientInstance.createConversation).mockRejectedValue(new Error('boom'))
      vi.mocked(CoreCryptoError.Mls.instanceOf).mockReturnValue(false)

      // when / then
      await expect(service.establishMlsConversation('group-id')).resolves.toBeUndefined()
    })
  })
})
