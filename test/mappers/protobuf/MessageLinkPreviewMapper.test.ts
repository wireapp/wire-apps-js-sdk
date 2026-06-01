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

import { describe, expect, it } from 'vitest'
import rootMessage from '../../../src/generated/messages.js'
import type { ILinkPreview } from '../../../src/generated/messages.js'
import { MessageLinkPreviewMapper } from '../../../src/mappers/protobuf/MessageLinkPreviewMapper.js'
import { MessageEncryptionAlgorithm } from '../../../src/model/protobuf/MessageEncryptionAlgorithm.js'
import type { LinkPreview } from '../../../src/model/WireMessage.js'

const { EncryptionAlgorithm } = rootMessage

const wireBlogUrl = "https://wire.com/blog"

describe('MessageLinkPreviewMapper', () => {
  it('maps LinkPreview without image to protobuf', () => {
    const linkPreview: LinkPreview = {
      url: wireBlogUrl,
      urlOffset: 7,
      permanentUrl: wireBlogUrl,
      title: 'Wire',
      summary: 'Secure collaboration',
      image: null
    }

    expect(MessageLinkPreviewMapper.toProtobuf(linkPreview)).toStrictEqual({
      url: wireBlogUrl,
      urlOffset: 7,
      permanentUrl: wireBlogUrl,
      title: 'Wire',
      summary: 'Secure collaboration'
    })
  })

  it('maps LinkPreview image to protobuf asset data', () => {
    const linkPreview: LinkPreview = {
      url: wireBlogUrl,
      urlOffset: 7,
      image: {
        mimeType: 'image/png',
        assetDataSize: 1234,
        assetHeight: 480,
        assetWidth: 640,
        assetName: 'preview.png',
        assetKey: 'asset-id',
        assetToken: 'asset-token',
        assetDomain: 'assets.wire.com',
        otrKey: new Uint8Array([1, 2, 3]),
        sha256Key: new Uint8Array([4, 5, 6]),
        encryptionAlgorithm: MessageEncryptionAlgorithm.AES_GCM
      }
    }

    const result = MessageLinkPreviewMapper.toProtobuf(linkPreview)

    expect(result.image?.original).toStrictEqual({
      size: 1234,
      mimeType: 'image/png',
      image: {
        width: 640,
        height: 480
      },
      name: 'preview.png'
    })
    expect(result.image?.uploaded).toStrictEqual({
      otrKey: new Uint8Array([1, 2, 3]),
      sha256: new Uint8Array([4, 5, 6]),
      assetId: 'asset-id',
      assetToken: 'asset-token',
      assetDomain: 'assets.wire.com',
      encryption: EncryptionAlgorithm.AES_GCM
    })
  })

  it('maps LinkPreview without image to domain', () => {
    const linkPreview: ILinkPreview = {
      url: wireBlogUrl,
      urlOffset: 7,
      permanentUrl: wireBlogUrl,
      title: 'Wire',
      summary: 'Secure collaboration'
    }

    expect(MessageLinkPreviewMapper.fromProtobuf(linkPreview)).toStrictEqual({
      url: wireBlogUrl,
      urlOffset: 7,
      permanentUrl: wireBlogUrl,
      title: 'Wire',
      summary: 'Secure collaboration',
      image: null
    })
  })

  it('maps LinkPreview image to domain asset data', () => {
    const linkPreview: ILinkPreview = {
      url: wireBlogUrl,
      urlOffset: 7,
      image: {
        original: {
          mimeType: 'image/png',
          size: 1234,
          name: 'preview.png',
          image: {
            width: 640,
            height: 480
          }
        },
        uploaded: {
          otrKey: new Uint8Array([1, 2, 3]),
          sha256: new Uint8Array([4, 5, 6]),
          assetId: 'asset-id',
          assetToken: 'asset-token',
          assetDomain: 'assets.wire.com',
          encryption: EncryptionAlgorithm.AES_GCM
        }
      }
    }

    expect(MessageLinkPreviewMapper.fromProtobuf(linkPreview)).toStrictEqual({
      url: wireBlogUrl,
      urlOffset: 7,
      permanentUrl: null,
      title: null,
      summary: null,
      image: {
        mimeType: 'image/png',
        assetDataSize: 1234,
        assetName: 'preview.png',
        assetHeight: 480,
        assetWidth: 640,
        assetDataPath: null,
        assetToken: 'asset-token',
        assetDomain: 'assets.wire.com',
        assetKey: 'asset-id',
        metadata: null,
        otrKey: new Uint8Array([1, 2, 3]),
        sha256Key: new Uint8Array([4, 5, 6]),
        encryptionAlgorithm: MessageEncryptionAlgorithm.AES_GCM
      }
    })
  })

  it('uses defaults for missing protobuf image fields', () => {
    const linkPreview: ILinkPreview = {
      url: wireBlogUrl,
      urlOffset: 0,
      image: {}
    }

    expect(MessageLinkPreviewMapper.fromProtobuf(linkPreview)).toStrictEqual({
      url: wireBlogUrl,
      urlOffset: 0,
      permanentUrl: null,
      title: null,
      summary: null,
      image: {
        mimeType: '*/*',
        assetDataSize: 0,
        assetName: null,
        assetHeight: 0,
        assetWidth: 0,
        assetDataPath: null,
        assetToken: null,
        assetDomain: null,
        assetKey: null,
        metadata: null,
        otrKey: new Uint8Array(0),
        sha256Key: new Uint8Array(0),
        encryptionAlgorithm: MessageEncryptionAlgorithm.AES_CBC
      }
    })
  })
})
