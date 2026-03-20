import {singleton} from "tsyringe";
import type {EventProcessor} from "./EventProcessor.js";
import type {MemberUpdateDTO} from "../../model/EventContentDTO.js";
import {ConversationService} from "../../api/ConversationService.js";
import {LoggerFactory} from "../../utils/logger/LoggerFactory.js";
import {obfuscateId} from "../../utils/ObfuscateUtil.js";

@singleton()
export class MemberUpdateEventProcessor implements EventProcessor<MemberUpdateDTO> {
  private logger = LoggerFactory.getLogger(this.constructor.name);

  constructor(private conversationService: ConversationService) {
  }

  async process(event: MemberUpdateDTO): Promise<void> {
    this.logger.info(`Processing MemberUpdate event for conversationId: ${obfuscateId(event.qualified_conversation.id)}`);

    await this.conversationService.updateMember(event.data.qualified_target, event.qualified_conversation, event.data.conversation_role);

    this.logger.info(`Processed MemberUpdate event for conversationId: ${obfuscateId(event.qualified_conversation.id)}`);
  }
}
