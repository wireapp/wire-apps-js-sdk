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

/* eslint-disable no-undef */

import {mkdir, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {type AssetMessage, TextMessage, WireEventsHandler} from '@wireapp/wire-apps-js-sdk'
import {exampleLogger} from '../ExampleLogger.js'

/**
 * This example demonstrates how to automatically download an asset when it's received in a conversation.
 * When an asset message is received, the app will download the asset and save it to the local file system.
 * After downloading, it will send a confirmation message back to the conversation.
 */
export class DownloadOnAssetReceivedExample extends WireEventsHandler {
  private static readonly OUTPUT_DIR = 'build/downloaded_assets/ts_sample'

  public override async onAssetMessageReceived(wireMessage: AssetMessage): Promise<void> {
    exampleLogger.info(`Received Asset Message. conversationId: ${wireMessage.conversationId}`)

    await this.saveAsset(wireMessage)
    await this.informConversationAfterDownload(wireMessage)
  }

  private async saveAsset(wireMessage: AssetMessage): Promise<void> {
    const remoteData = wireMessage.remoteData
    if (!remoteData) {
      return
    }

    const asset = await this.manager.downloadAsset(remoteData)
    const fileName = wireMessage.name?.trim() ? wireMessage.name.trim() : `unknown-${crypto.randomUUID()}`
    const filePath = path.join(DownloadOnAssetReceivedExample.OUTPUT_DIR, fileName)

    try {
      await mkdir(DownloadOnAssetReceivedExample.OUTPUT_DIR, {recursive: true})
      await writeFile(filePath, asset)
      exampleLogger.info(`Downloaded asset with size: ${asset.length} bytes, saved to: ${filePath}`)
    } catch (error) {
      exampleLogger.error('Failed to write asset file', error)
    }
  }

  private async informConversationAfterDownload(wireMessage: AssetMessage): Promise<void> {
    const infoMessage = TextMessage.create({
      conversationId: wireMessage.conversationId,
      text: `ℹ️ I've downloaded the asset you sent. The file name is '${wireMessage.name}'.`
    })

    await this.manager.sendMessage(infoMessage)
  }
}
