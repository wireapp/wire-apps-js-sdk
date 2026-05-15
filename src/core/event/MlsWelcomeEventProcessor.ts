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

import {inject, injectable} from "tsyringe";
import {Decoder} from "bazinga64";
import type {EventProcessor} from "./EventProcessor.js";
import type {MLSWelcomeDTO} from "../../model/EventContentDTO.js";
import {CoreCryptoService} from "./../CoreCryptoService.js";
import {ConversationService} from "../../api/ConversationService.js";
import {MlsService} from "../../api/MlsService.js";
import {WireEventsHandler} from "./../WireEventsHandler.js";
import {WIRE_EVENTS_HANDLER, CRYPTO_CLIENT_ID, EVENT_PROCESSOR} from "../../utils/DependencyInjectionTokens.js";
import {ConversationMapper} from "../../mappers/conversation/ConversationMapper.js";
import {container} from "tsyringe";
import {QualifiedId} from "../../model/QualifiedId.js";

@injectable({token: EVENT_PROCESSOR})
export class MlsWelcomeEventProcessor implements EventProcessor<MLSWelcomeDTO> {

  readonly eventType = "conversation.mls-welcome" as const;

  constructor(
    private coreCryptoService: CoreCryptoService,
    private conversationService: ConversationService,
    private mlsService: MlsService,
    @inject(WIRE_EVENTS_HANDLER) private wireEventsHandler: WireEventsHandler
  ) {
  }

  async process(event: MLSWelcomeDTO): Promise<void> {
    const welcomeEventInBytes = Decoder.fromBase64(event.data).asBytes;
    const groupInfoBytes = await this.conversationService.getConversationGroupInfo(event.qualified_conversation);
    await this.coreCryptoService.processWelcomeMessage(welcomeEventInBytes, groupInfoBytes);

    const conversationId = new QualifiedId(event.qualified_conversation.id, event.qualified_conversation.domain);

    const conversationResponse = await this.conversationService.fetchConversationById(conversationId);
    const {conversation, members} = await this.conversationService.saveConversationWithMembers(
      conversationId,
      conversationResponse
    );

    if (await this.coreCryptoService.hasTooFewKeyPackageCount()) {
      if (container.isRegistered(CRYPTO_CLIENT_ID)) {
        const keyPackages = await this.coreCryptoService.mlsGenerateKeyPackages();
        await this.mlsService.uploadMlsKeyPackages(keyPackages);
      }
    }

    await this.wireEventsHandler.onAppAddedToConversation(
      ConversationMapper.fromEntity(conversation),
      members
    );
  }
}
