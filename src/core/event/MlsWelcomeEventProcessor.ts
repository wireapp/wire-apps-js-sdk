import {inject, singleton} from "tsyringe";
import {Decoder} from "bazinga64";
import type {EventProcessor} from "./EventProcessor.js";
import type {MLSWelcomeDTO} from "../../model/EventContentDTO.js";
import {CoreCryptoService} from "./../CoreCryptoService.js";
import {ConversationService} from "../../api/ConversationService.js";
import {MlsService} from "../../api/MlsService.js";
import {WireEventsHandler} from "./../WireEventsHandler.js";
import {WIRE_EVENTS_HANDLER, APP_CLIENT_ID} from "../../utils/DependencyInjectionTokens.js";
import {ConversationMapper} from "../../mappers/conversation/ConversationMapper.js";
import {container} from "tsyringe";

@singleton()
export class MlsWelcomeEventProcessor implements EventProcessor<MLSWelcomeDTO> {

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

    const conversationResponse = await this.conversationService.fetchConversationById(event.qualified_conversation);
    const {conversation, members} = await this.conversationService.saveConversationWithMembers(
      event.qualified_conversation,
      conversationResponse
    );

    if (await this.coreCryptoService.hasTooFewKeyPackageCount()) {
      if (container.isRegistered(APP_CLIENT_ID)) {
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
