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

import {singleton} from "tsyringe";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import type {QualifiedId} from "../model/QualifiedId.js";
import {CoreCryptoService} from "../core/CoreCryptoService.js";
import {ConversationService} from "../api/ConversationService.js";
import {obfuscateId} from "../utils/ObfuscateUtil.js";

@singleton()
export class MlsFallbackStrategy {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  constructor(
    private coreCryptoService: CoreCryptoService,
    private conversationService: ConversationService
  ) { }

  async verifyConversationOutOfSync(
    mlsGroupId: string,
    conversationId: QualifiedId
  ) {
    const conversationExists = await this.coreCryptoService.conversationExists(mlsGroupId)
    const remoteConversationEpoch = await this.conversationService.fetchEpoch(conversationId)
    const localConversationEpoch = await this.coreCryptoService.conversationEpoch(mlsGroupId)
    const isEpochBehind = localConversationEpoch < remoteConversationEpoch

    this.logger.info(
      `Verifying Fallback Strategy for conversationId: ${obfuscateId(conversationId.id)}, ` +
        `exists: ${conversationExists} ` +
        `epoch: local[${localConversationEpoch}] < remote[${remoteConversationEpoch}]`
    )

    if (!conversationExists || isEpochBehind) {
      const groupInfoBytes = await this.conversationService.getConversationGroupInfo(conversationId)
      await this.coreCryptoService.joinMlsConversationRequest(groupInfoBytes)
    }
  }
}
