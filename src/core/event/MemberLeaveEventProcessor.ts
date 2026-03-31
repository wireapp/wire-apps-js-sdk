import {inject, singleton} from "tsyringe";
import type {EventProcessor} from "./EventProcessor.js";
import type {MemberLeaveDTO} from "../../model/EventContentDTO.js";
import {ConversationService} from "../../api/ConversationService.js";
import {WireEventsHandler} from "./../WireEventsHandler.js";
import {WIRE_EVENTS_HANDLER} from "../../utils/DependencyInjectionTokens.js";
import {LoggerFactory} from "../../utils/logger/LoggerFactory.js";
import {obfuscateId} from "../../utils/ObfuscateUtil.js";

@singleton()
export class MemberLeaveEventProcessor implements EventProcessor<MemberLeaveDTO> {
  private logger = LoggerFactory.getLogger(this.constructor.name);

  readonly eventType = "conversation.member-leave" as const;

  constructor(
    private conversationService: ConversationService,
    @inject(WIRE_EVENTS_HANDLER) private wireEventsHandler: WireEventsHandler
  ) {
  }

  async process(event: MemberLeaveDTO): Promise<void> {
    this.logger.info(`Processing MemberLeave event for conversationId: ${obfuscateId(event.qualified_conversation.id)}`);

    await this.conversationService.removeMembers(event.data.qualified_user_ids, event.qualified_conversation);
    await this.wireEventsHandler.onUserLeftConversation(event.qualified_conversation, event.data.qualified_user_ids);

    this.logger.info(`Processed MemberLeave event for conversationId: ${obfuscateId(event.qualified_conversation.id)}`);
  }
}
