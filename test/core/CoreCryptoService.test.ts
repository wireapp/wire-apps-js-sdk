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
import {container} from 'tsyringe'
import {CoreCryptoService} from '../../src/core/CoreCryptoService.js'
import {CoreCryptoClient} from '../../src/core/CoreCryptoClient.js'
import type {ClientsService} from '../../src/api/ClientsService.js'
import type {MlsService} from '../../src/api/MlsService.js'
import type {CoreCryptoMlsTransport} from '../../src/core/CoreCryptoMlsTransport.js'
import type {FeatureConfigsService} from '../../src/api/FeatureConfigsService.js'
import type {AppProperties} from '../../src/service/AppProperties.js'
import {APP_CLIENT_ID} from '../../src/utils/DependencyInjectionTokens.js'
import type {AppClientId} from '../../src/model/AppClientId.js'

vi.mock('../../src/core/CoreCryptoClient.js', () => ({
  CoreCryptoClient: {
    create: vi.fn(),
    getMlsCiphersuiteName: vi.fn(),
  },
}))

const USER_ID = 'user-id-abc'
const USER_DOMAIN = 'example.com'
const STORED_DEVICE_ID = 'device-id-123'
const REGISTERED_DEVICE_ID = 'device-id-new-456'

describe('CoreCryptoService', () => {
  let service: CoreCryptoService
  let mockCoreCryptoClient: Record<string, ReturnType<typeof vi.fn>>
  let mockClientsService: ClientsService
  let mockMlsService: MlsService
  let mockMlsTransport: CoreCryptoMlsTransport
  let mockFeatureConfigsService: FeatureConfigsService
  let mockAppProperties: AppProperties

  beforeEach(async () => {
    container.clearInstances()
    vi.clearAllMocks()

    mockCoreCryptoClient = {
      initProteusClient: vi.fn().mockResolvedValue(undefined),
      generateProteusPreKeys: vi.fn().mockResolvedValue([]),
      generateProteusLastPreKey: vi.fn().mockResolvedValue({}),
      initMlsClient: vi.fn().mockResolvedValue(undefined),
      getMlsPublicKey: vi.fn().mockResolvedValue({}),
      mlsGenerateKeyPackages: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined),
    }

    vi.mocked(CoreCryptoClient.create).mockResolvedValue(mockCoreCryptoClient as unknown as CoreCryptoClient)

    mockClientsService = {
      registerClient: vi.fn().mockResolvedValue(REGISTERED_DEVICE_ID),
      updateClientWithMlsPublicKey: vi.fn().mockResolvedValue(undefined),
    } as unknown as ClientsService

    mockMlsService = {
      uploadMlsKeyPackages: vi.fn().mockResolvedValue(undefined),
    } as unknown as MlsService

    mockMlsTransport = {} as CoreCryptoMlsTransport

    mockFeatureConfigsService = {
      getDefaultCipherSuite: vi.fn().mockResolvedValue(1),
    } as unknown as FeatureConfigsService

    mockAppProperties = {
      getDeviceId: vi.fn(),
      setDeviceId: vi.fn(),
      setShouldRejoinConversations: vi.fn(),
    } as unknown as AppProperties

    service = new CoreCryptoService(
      USER_ID,
      USER_DOMAIN,
      'storage-password',
      mockFeatureConfigsService,
      mockClientsService,
      mockMlsService,
      mockMlsTransport,
      mockAppProperties
    )

    await service.initCoreCryptoClient()
  })

  describe('initOrRegisterClient', () => {
    it('should throw when coreCryptoClient is not initialized', async () => {
      const uninitializedService = new CoreCryptoService(
        USER_ID,
        USER_DOMAIN,
        'storage-password',
        mockFeatureConfigsService,
        mockClientsService,
        mockMlsService,
        mockMlsTransport,
        mockAppProperties
      )
      await expect(uninitializedService.initOrRegisterClient()).rejects.toThrow(
        'CoreCryptoClient is not initialized.'
      )
    })

    it('should always call initProteusClient', async () => {
      vi.mocked(mockAppProperties.getDeviceId).mockReturnValue(undefined)
      await service.initOrRegisterClient()
      expect(mockCoreCryptoClient.initProteusClient).toHaveBeenCalledOnce()
    })

    describe('first registration (no stored device ID)', () => {
      beforeEach(() => {
        vi.mocked(mockAppProperties.getDeviceId).mockReturnValue(undefined)
      })

      it('should generate pre-keys and call registerClient', async () => {
        await service.initOrRegisterClient()

        expect(mockCoreCryptoClient.generateProteusPreKeys).toHaveBeenCalledOnce()
        expect(mockCoreCryptoClient.generateProteusLastPreKey).toHaveBeenCalledOnce()
        expect(mockClientsService.registerClient).toHaveBeenCalledOnce()
      })

      it('should persist the returned device ID', async () => {
        await service.initOrRegisterClient()

        expect(mockAppProperties.setDeviceId).toHaveBeenCalledWith(REGISTERED_DEVICE_ID)
      })

      it('should register the correct AppClientId in the DI container', async () => {
        await service.initOrRegisterClient()

        const appClientId = container.resolve<AppClientId>(APP_CLIENT_ID)
        expect(appClientId.value).toBe(`${USER_ID}:${REGISTERED_DEVICE_ID}@${USER_DOMAIN}`)
      })

      it('should call initMlsClient with the newly registered AppClientId', async () => {
        await service.initOrRegisterClient()

        expect(mockCoreCryptoClient.initMlsClient).toHaveBeenCalledOnce()
        const [calledWith] = vi.mocked(mockCoreCryptoClient.initMlsClient).mock.calls[0]
        expect((calledWith as AppClientId).value).toBe(`${USER_ID}:${REGISTERED_DEVICE_ID}@${USER_DOMAIN}`)
      })

      it('should upload the MLS public key', async () => {
        await service.initOrRegisterClient()

        expect(mockCoreCryptoClient.getMlsPublicKey).toHaveBeenCalledOnce()
        expect(mockClientsService.updateClientWithMlsPublicKey).toHaveBeenCalledOnce()
      })

      it('should upload MLS key packages', async () => {
        await service.initOrRegisterClient()

        expect(mockCoreCryptoClient.mlsGenerateKeyPackages).toHaveBeenCalledOnce()
        expect(mockMlsService.uploadMlsKeyPackages).toHaveBeenCalledOnce()
      })

      it('should set shouldRejoinConversations to true', async () => {
        await service.initOrRegisterClient()

        expect(mockAppProperties.setShouldRejoinConversations).toHaveBeenCalledWith(true)
      })

      it('should wrap registerClient errors with a descriptive message', async () => {
        vi.mocked(mockClientsService.registerClient).mockRejectedValue(new Error('network error'))

        await expect(service.initOrRegisterClient()).rejects.toThrow(
          'Error when registering client: network error'
        )
      })
    })

    describe('subsequent startup (stored device ID exists)', () => {
      beforeEach(() => {
        vi.mocked(mockAppProperties.getDeviceId).mockReturnValue(STORED_DEVICE_ID)
      })

      it('should not generate pre-keys or call registerClient', async () => {
        await service.initOrRegisterClient()

        expect(mockCoreCryptoClient.generateProteusPreKeys).not.toHaveBeenCalled()
        expect(mockCoreCryptoClient.generateProteusLastPreKey).not.toHaveBeenCalled()
        expect(mockClientsService.registerClient).not.toHaveBeenCalled()
      })

      it('should not overwrite the stored device ID', async () => {
        await service.initOrRegisterClient()

        expect(mockAppProperties.setDeviceId).not.toHaveBeenCalled()
      })

      it('should register the correct AppClientId in the DI container using the stored ID', async () => {
        await service.initOrRegisterClient()

        const appClientId = container.resolve<AppClientId>(APP_CLIENT_ID)
        expect(appClientId.value).toBe(`${USER_ID}:${STORED_DEVICE_ID}@${USER_DOMAIN}`)
      })

      it('should call initMlsClient with the stored device AppClientId', async () => {
        await service.initOrRegisterClient()

        expect(mockCoreCryptoClient.initMlsClient).toHaveBeenCalledOnce()
        const [calledWith] = vi.mocked(mockCoreCryptoClient.initMlsClient).mock.calls[0]
        expect((calledWith as AppClientId).value).toBe(`${USER_ID}:${STORED_DEVICE_ID}@${USER_DOMAIN}`)
      })

      it('should skip MLS public key upload', async () => {
        await service.initOrRegisterClient()

        expect(mockClientsService.updateClientWithMlsPublicKey).not.toHaveBeenCalled()
        expect(mockCoreCryptoClient.getMlsPublicKey).not.toHaveBeenCalled()
      })

      it('should skip MLS key package upload', async () => {
        await service.initOrRegisterClient()

        expect(mockMlsService.uploadMlsKeyPackages).not.toHaveBeenCalled()
        expect(mockCoreCryptoClient.mlsGenerateKeyPackages).not.toHaveBeenCalled()
      })

      it('should not set shouldRejoinConversations', async () => {
        await service.initOrRegisterClient()

        expect(mockAppProperties.setShouldRejoinConversations).not.toHaveBeenCalled()
      })
    })
  })
})
