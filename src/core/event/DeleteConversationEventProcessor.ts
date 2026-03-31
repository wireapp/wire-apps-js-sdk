import {inject, singleton} from "tsyringe";
import type {EventProcessor} from "./EventProcessor.js";
import type {DeleteConversationDTO} from "../../model/EventContentDTO.js";
import {ConversationService} from "../../api/ConversationService.js";
import {WireEventsHandler} from "../WireEventsHandler.js";
import {WIRE_EVENTS_HANDLER} from "../../utils/DependencyInjectionTokens.js";
import {LoggerFactory} from "../../utils/logger/LoggerFactory.js";
import {obfuscateId} from "../../utils/ObfuscateUtil.js";

@singleton()
export class DeleteConversationEventProcessor implements EventProcessor<DeleteConversationDTO> {
  private logger = LoggerFactory.getLogger(this.constructor.name);

  readonly eventType = "conversation.delete" as const;

  constructor(
    private conversationService: ConversationService,
    @inject(WIRE_EVENTS_HANDLER) private wireEventsHandler: WireEventsHandler
  ) {
  }

  async process(event: DeleteConversationDTO): Promise<void> {
    this.logger.info(`Processing DeleteConversation event for conversationId: ${obfuscateId(event.qualified_conversation.id)}`);

    await this.conversationService.deleteAllConversationDataFromLocalStorages(event.qualified_conversation);
    await this.wireEventsHandler.onConversationDeleted(event.qualified_conversation);

    this.logger.info(`Processed DeleteConversation event for conversationId: ${obfuscateId(event.qualified_conversation.id)}`);
  }
}
