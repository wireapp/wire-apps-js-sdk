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

import { describe, expect, it, vi } from 'vitest'
import { WireApplicationManager } from '../../src/core/WireApplicationManager.js'
import { QualifiedId } from '../../src/model/QualifiedId.js'

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
    const manager = new WireApplicationManager(
      {} as any,
      {} as any,
      {} as any,
      assetsTransferService as any,
      {} as any
    )
    const sendMessage = vi
      .spyOn(manager, 'sendMessage')
      .mockResolvedValue('sent-message-id')

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
    expect(sendMessage.mock.calls[0][0]).toMatchObject({
      type: 'asset',
      conversationId,
      mimeType: 'image/png',
      name: 'image.png',
      sizeInBytes: 3,
      remoteData,
      expiresAfterMillis: 5000
    })
  })
})
