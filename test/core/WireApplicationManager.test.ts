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

import {describe, expect, it, vi} from 'vitest'
import {WireApplicationManager} from '../../src/core/WireApplicationManager.js'
import {QualifiedId} from '../../src/model/QualifiedId.js'
import type {WireUser} from '../../src/model/WireUser.js'

describe('WireApplicationManager', () => {
  const conversationId = new QualifiedId('conversation-id', 'wire.com')

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
    const manager = new WireApplicationManager({} as any, {} as any, {} as any, assetsTransferService as any, {} as any)
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

  describe('searchUsers', () => {
    it('delegates to userService and returns results', async () => {
      const mockUsers: WireUser[] = [
        {id: new QualifiedId('user-1', 'wire.com'), name: 'Alice', handle: 'alice', deleted: false},
        {id: new QualifiedId('user-2', 'wire.com'), name: 'Bob', handle: 'bob', deleted: false}
      ]
      const userService = {
        searchUsers: vi.fn().mockResolvedValue(mockUsers)
      }
      const manager = new WireApplicationManager({} as any, {} as any, {} as any, {} as any, userService as any)

      const result = await manager.searchUsers('ali', 'wire.com', 10)

      expect(result).toEqual(mockUsers)
      expect(userService.searchUsers).toHaveBeenCalledWith('ali', 'wire.com', 10)
    })

    it('passes undefined numberOfResults when omitted', async () => {
      const userService = {
        searchUsers: vi.fn().mockResolvedValue([])
      }
      const manager = new WireApplicationManager({} as any, {} as any, {} as any, {} as any, userService as any)

      await manager.searchUsers('ali', 'wire.com')

      expect(userService.searchUsers).toHaveBeenCalledWith('ali', 'wire.com', undefined)
    })

    it('returns an empty array when no users match', async () => {
      const userService = {
        searchUsers: vi.fn().mockResolvedValue([])
      }
      const manager = new WireApplicationManager({} as any, {} as any, {} as any, {} as any, userService as any)

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
      const manager = new WireApplicationManager({} as any, conversationService as any, {} as any, {} as any, {} as any)

      const result = await manager.createGroupConversation('Test Group', userIds)

      expect(conversationService.createGroup).toHaveBeenCalledWith('Test Group', userIds)
      expect(result).toBe(createdConversationId)
    })

    it('propagates errors from conversationService.createGroup', async () => {
      const conversationService = {
        createGroup: vi.fn().mockRejectedValue(new Error('create-group-failed'))
      }
      const manager = new WireApplicationManager({} as any, conversationService as any, {} as any, {} as any, {} as any)

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
      const manager = new WireApplicationManager({} as any, conversationService as any, {} as any, {} as any, {} as any)

      const result = await manager.createChannelConversation('Test Channel', userIds)

      expect(conversationService.createChannel).toHaveBeenCalledWith('Test Channel', userIds)
      expect(result).toBe(createdConversationId)
    })

    it('propagates errors from conversationService.createChannel', async () => {
      const conversationService = {
        createChannel: vi.fn().mockRejectedValue(new Error('create-channel-failed'))
      }
      const manager = new WireApplicationManager({} as any, conversationService as any, {} as any, {} as any, {} as any)

      await expect(manager.createChannelConversation('Test Channel', [])).rejects.toThrow('create-channel-failed')
    })
  })
})
