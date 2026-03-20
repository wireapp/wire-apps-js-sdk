import {singleton} from "tsyringe";
import type {EventProcessor} from "./EventProcessor.js";
import type {NewConversationDTO} from "../../model/EventContentDTO.js";
import {ConversationService} from "../../api/ConversationService.js";
import {LoggerFactory} from "../../utils/logger/LoggerFactory.js";
import {obfuscateId} from "../../utils/ObfuscateUtil.js";

@singleton()
export class NewConversationEventProcessor implements EventProcessor<NewConversationDTO> {
  private logger = LoggerFactory.getLogger(this.constructor.name);

  constructor(private conversationService: ConversationService) {
  }

  async process(event: NewConversationDTO): Promise<void> {
    this.logger.info(`Processing NewConversation event for conversationId: ${obfuscateId(event.qualified_conversation.id)}`);

    await this.conversationService.saveConversationWithMembers(event.qualified_conversation, event.data);

    this.logger.info(`Processed NewConversation event for conversationId: ${obfuscateId(event.qualified_conversation.id)}`);
  }
}
