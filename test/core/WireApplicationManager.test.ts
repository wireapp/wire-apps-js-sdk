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

import {afterEach, describe, expect, it, vi} from 'vitest'
import {WireApplicationManager} from '../../src/core/WireApplicationManager.js'
import {QualifiedId} from '../../src/model/QualifiedId.js'
import type {WireUser} from '../../src/model/WireUser.js'
import {Ping, TextMessage} from '../../src/model/WireMessage.js'
import {ProtobufSerializer} from '../../src/mappers/protobuf/ProtobufSerializer.js'

describe('WireApplicationManager', () => {
  const conversationId = new QualifiedId('conversation-id', 'wire.com')
  const appQualifiedId = new QualifiedId('app-id', 'wire.com')

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createManager = ({
    coreCryptoService = {},
    conversationService = {},
    mlsService = {},
    assetsTransferService = {},
    userService = {},
    appProperties = {}
  }: {
    coreCryptoService?: any
    conversationService?: any
    mlsService?: any
    assetsTransferService?: any
    userService?: any
    appProperties?: any
  } = {}) =>
    new WireApplicationManager(
      coreCryptoService as any,
      conversationService as any,
      mlsService as any,
      assetsTransferService as any,
      userService as any,
      appProperties as any
    )

  describe('sendMessage', () => {
    const makeSendDependencies = () => ({
      coreCryptoService: {
        encryptMls: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6]))
      },
      conversationService: {
        getConversationMLSGroupId: vi.fn().mockResolvedValue('mls-group-id')
      },
      mlsService: {
        sendMessage: vi.fn().mockResolvedValue(undefined)
      },
      appProperties: {
        getApplicationQualifiedId: vi.fn().mockReturnValue(appQualifiedId)
      }
    })

    it('adds the app qualified id as sender before serializing outgoing messages', async () => {
      const dependencies = makeSendDependencies()
      const manager = createManager(dependencies)
      const serializerSpy = vi
        .spyOn(ProtobufSerializer, 'toGenericMessageByteArray')
        .mockReturnValue(new Uint8Array([1, 2, 3]))
      const message = TextMessage.create({conversationId, text: 'hello'})

      await manager.sendMessage(message)

      expect(serializerSpy).toHaveBeenCalledWith(expect.objectContaining({sender: appQualifiedId}))
      expect(dependencies.appProperties.getApplicationQualifiedId).toHaveBeenCalledOnce()
    })

    it('keeps an explicitly provided sender', async () => {
      const dependencies = makeSendDependencies()
      const manager = createManager(dependencies)
      const serializerSpy = vi
        .spyOn(ProtobufSerializer, 'toGenericMessageByteArray')
        .mockReturnValue(new Uint8Array([1, 2, 3]))
      const explicitSender = new QualifiedId('sender-id', 'wire.com')
      const message = TextMessage.create({conversationId, text: 'hello', senderId: explicitSender})

      await manager.sendMessage(message)

      expect(serializerSpy).toHaveBeenCalledWith(expect.objectContaining({sender: explicitSender}))
      expect(dependencies.appProperties.getApplicationQualifiedId).not.toHaveBeenCalled()
    })

    it('adds the app qualified id as sender for message types that omit sender in the model layer', async () => {
      const dependencies = makeSendDependencies()
      const manager = createManager(dependencies)
      const serializerSpy = vi
        .spyOn(ProtobufSerializer, 'toGenericMessageByteArray')
        .mockReturnValue(new Uint8Array([1, 2, 3]))
      const message = Ping.create({conversationId})

      await manager.sendMessage(message)

      expect(serializerSpy).toHaveBeenCalledWith(expect.objectContaining({sender: appQualifiedId}))
      expect(dependencies.appProperties.getApplicationQualifiedId).toHaveBeenCalledOnce()
    })
  })

  it('passes asset expiration to the sent asset message', async () => {
    const remoteData = {
      otrKey: new Uint8Array([1, 2, 3]),
      sha256: new Uint8Array([4, 5, 6]),
      assetId: 'asset-id',
      assetToken: 'asset-token',
      assetDomain: 'assets.wire.com'
    }
    const assetsTransferService = {
      uploadAssetForSending: vi.fn().mockResolvedValue(remoteData)
    }
    const manager = createManager({assetsTransferService})
    const sendMessage = vi.spyOn(manager, 'sendMessage').mockResolvedValue('sent-message-id')

    const result = await manager.sendAsset(
      conversationId,
      {
        data: new Uint8Array([7, 8, 9]),
        name: 'image.png',
        mimeType: 'image/png'
      },
      5000
    )

    expect(result).toBe('sent-message-id')
    expect(assetsTransferService.uploadAssetForSending).toHaveBeenCalledWith(new Uint8Array([7, 8, 9]))
    expect(sendMessage).toHaveBeenCalledOnce()
    expect(sendMessage.mock.calls[0]![0]).toMatchObject({
      type: 'asset',
      conversationId,
      mimeType: 'image/png',
      name: 'image.png',
      sizeInBytes: 3,
      remoteData,
      expiresAfterMillis: 5000
    })
  })

  describe('getUsers', () => {
    it('delegates to userService.getUsers and returns results', async () => {
      const userIds = [new QualifiedId('user-1', 'wire.com'), new QualifiedId('user-2', 'wire.com')]
      const mockUsers: WireUser[] = [
        {id: userIds[0]!, name: 'Alice', handle: 'alice', deleted: false},
        {id: userIds[1]!, name: 'Bob', handle: 'bob', deleted: false}
      ]
      const userService = {
        getUsers: vi.fn().mockResolvedValue(mockUsers)
      }
      const manager = createManager({userService})

      const result = await manager.getUsers(userIds)

      expect(result).toEqual(mockUsers)
      expect(userService.getUsers).toHaveBeenCalledWith(userIds)
    })

    it('returns an empty array when no users are found', async () => {
      const userService = {
        getUsers: vi.fn().mockResolvedValue([])
      }
      const manager = createManager({userService})

      const result = await manager.getUsers([new QualifiedId('user-1', 'wire.com')])

      expect(result).toEqual([])
    })

    it('propagates errors from userService.getUsers', async () => {
      const userService = {
        getUsers: vi.fn().mockRejectedValue(new Error('fetch-failed'))
      }
      const manager = createManager({userService})

      await expect(manager.getUsers([new QualifiedId('user-1', 'wire.com')])).rejects.toThrow('fetch-failed')
    })
  })

  describe('searchUsers', () => {
    it('delegates to userService and returns results', async () => {
      const mockUsers: WireUser[] = [
        {id: new QualifiedId('user-1', 'wire.com'), name: 'Alice', handle: 'alice', deleted: false},
        {id: new QualifiedId('user-2', 'wire.com'), name: 'Bob', handle: 'bob', deleted: false}
      ]
      const userService = {
        searchUsers: vi.fn().mockResolvedValue(mockUsers)
      }
      const manager = createManager({userService})

      const result = await manager.searchUsers('ali', 'wire.com', 10)

      expect(result).toEqual(mockUsers)
      expect(userService.searchUsers).toHaveBeenCalledWith('ali', 'wire.com', 10)
    })

    it('passes undefined numberOfResults when omitted', async () => {
      const userService = {
        searchUsers: vi.fn().mockResolvedValue([])
      }
      const manager = createManager({userService})

      await manager.searchUsers('ali', 'wire.com')

      expect(userService.searchUsers).toHaveBeenCalledWith('ali', 'wire.com', undefined)
    })

    it('returns an empty array when no users match', async () => {
      const userService = {
        searchUsers: vi.fn().mockResolvedValue([])
      }
      const manager = createManager({userService})

      const result = await manager.searchUsers('nonexistent', 'wire.com', 5)

      expect(result).toEqual([])
    })
  })

  describe('createGroupConversation', () => {
    it('delegates to conversationService.createGroup and returns the conversation id', async () => {
      const userIds = [new QualifiedId('user-1', 'wire.com'), new QualifiedId('user-2', 'wire.com')]
      const createdConversationId = new QualifiedId('new-conversation-id', 'wire.com')
      const conversationService = {
        createGroup: vi.fn().mockResolvedValue(createdConversationId)
      }
      const manager = createManager({conversationService})

      const result = await manager.createGroupConversation('Test Group', userIds)

      expect(conversationService.createGroup).toHaveBeenCalledWith('Test Group', userIds)
      expect(result).toBe(createdConversationId)
    })

    it('propagates errors from conversationService.createGroup', async () => {
      const conversationService = {
        createGroup: vi.fn().mockRejectedValue(new Error('create-group-failed'))
      }
      const manager = createManager({conversationService})

      await expect(manager.createGroupConversation('Test Group', [])).rejects.toThrow('create-group-failed')
    })
  })

  describe('createChannelConversation', () => {
    it('delegates to conversationService.createChannel and returns the conversation id', async () => {
      const userIds = [new QualifiedId('user-1', 'wire.com'), new QualifiedId('user-2', 'wire.com')]
      const createdConversationId = new QualifiedId('new-channel-id', 'wire.com')
      const conversationService = {
        createChannel: vi.fn().mockResolvedValue(createdConversationId)
      }
      const manager = createManager({conversationService})

      const result = await manager.createChannelConversation('Test Channel', userIds)

      expect(conversationService.createChannel).toHaveBeenCalledWith('Test Channel', userIds)
      expect(result).toBe(createdConversationId)
    })

    it('propagates errors from conversationService.createChannel', async () => {
      const conversationService = {
        createChannel: vi.fn().mockRejectedValue(new Error('create-channel-failed'))
      }
      const manager = createManager({conversationService})

      await expect(manager.createChannelConversation('Test Channel', [])).rejects.toThrow('create-channel-failed')
    })
  })
})
