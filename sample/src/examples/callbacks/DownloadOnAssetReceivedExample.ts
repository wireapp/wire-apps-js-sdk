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
import {type AssetMessage, type QualifiedId, TextMessage, WireEventsHandler} from '@wireapp/wire-apps-js-sdk'
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

    const savedFilePath = await this.saveAsset(wireMessage)

    // Only confirm the download if the asset really ended up on the file system
    if (savedFilePath) {
      await this.informConversationAfterDownload(path.basename(savedFilePath), wireMessage.conversationId)
    }
  }

  /**
   * Downloads the asset and saves it in the output directory.
   *
   * @returns the path of the saved file, or `undefined` if the asset could not be saved
   */
  private async saveAsset(wireMessage: AssetMessage): Promise<string | undefined> {
    const remoteData = wireMessage.remoteData
    if (!remoteData) {
      exampleLogger.warn(`Asset message has no remote data. conversationId: ${wireMessage.conversationId}`)
      return undefined
    }

    const filePath = this.resolveFilePath(wireMessage.name)
    if (!filePath) {
      return undefined
    }

    const asset = await this.manager.downloadAsset(remoteData)

    try {
      await mkdir(path.dirname(filePath), {recursive: true})
      await writeFile(filePath, asset)
    } catch (error) {
      exampleLogger.error('Failed to write asset file', error)
      return undefined
    }

    exampleLogger.info(`Downloaded asset with size: ${asset.length} bytes, saved to: ${filePath}`)
    return filePath
  }

  private resolveFilePath(assetName: string | null | undefined): string | undefined {
    const outputDir = path.resolve(DownloadOnAssetReceivedExample.OUTPUT_DIR)
    const trimmedName = assetName?.trim()
    const fileName = trimmedName ? path.basename(trimmedName) : `unknown-${crypto.randomUUID()}`
    const filePath = path.resolve(outputDir, fileName)

    if (!filePath.startsWith(outputDir + path.sep)) {
      exampleLogger.warn(`Refusing to save an asset outside of ${outputDir}. Asset name: '${assetName}'`)
      return undefined
    }

    return filePath
  }

  private async informConversationAfterDownload(fileName: string, conversationId: QualifiedId): Promise<void> {
    const infoMessage = TextMessage.create({
      conversationId: conversationId,
      text: `ℹ️ I've downloaded the asset you sent. The file name is '${fileName}'.`
    })

    await this.manager.sendMessage(infoMessage)
  }
}
