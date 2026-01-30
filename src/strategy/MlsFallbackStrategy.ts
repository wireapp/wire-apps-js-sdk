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
    const fetchedConversation = await this.conversationService.fetchConversationById(conversationId)
    const conversationEpoch = fetchedConversation.epoch
    const currentConversationEpoch = await this.coreCryptoService.conversationEpoch(mlsGroupId)
    const isEpochBehind = conversationEpoch != null && currentConversationEpoch < conversationEpoch

    this.logger.info(
      "Verifying Fallback Strategy for conversationId: {}, " +
        "exists: {} " +
        "epoch: local[{}] < remote[{}]",
      conversationId,
      conversationExists,
      currentConversationEpoch,
      conversationEpoch
    )

    if (!conversationExists || isEpochBehind) {
      const groupInfoBytes = await this.conversationService.getConversationGroupInfo(conversationId)
      this.coreCryptoService.joinMlsConversationRequest(groupInfoBytes)
    }
  }
}
