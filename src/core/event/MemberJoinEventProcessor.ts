import {inject, singleton} from "tsyringe";
import type {EventProcessor} from "./EventProcessor.js";
import type {MemberJoinDTO} from "../../model/EventContentDTO.js";
import {ConversationService} from "../../api/ConversationService.js";
import {WireEventsHandler} from "../WireEventsHandler.js";
import {WIRE_EVENTS_HANDLER} from "../../utils/DependencyInjectionTokens.js";
import type {ConversationMember} from "../../model/conversation/ConversationMember.js";
import {LoggerFactory} from "../../utils/logger/LoggerFactory.js";
import {obfuscateId} from "../../utils/ObfuscateUtil.js";

@singleton()
export class MemberJoinEventProcessor implements EventProcessor<MemberJoinDTO> {
  private logger = LoggerFactory.getLogger(this.constructor.name);

  readonly eventType = "conversation.member-join" as const;

  constructor(
    private conversationService: ConversationService,
    @inject(WIRE_EVENTS_HANDLER) private wireEventsHandler: WireEventsHandler
  ) {
  }

  async process(event: MemberJoinDTO): Promise<void> {
    this.logger.info(`Processing MemberJoin event for conversationId: ${obfuscateId(event.qualified_conversation.id)}`);

    const members: ConversationMember[] = (event.data.users || []).map(user => ({
      userId: user.qualified_id,
      role: user.conversation_role
    }));

    this.logger.info(`New members to be added: ${members.map(m => obfuscateId(m.userId.id)).join()}`);
    await this.conversationService.addMembers(members, event.qualified_conversation);
    await this.wireEventsHandler.onUserJoinedConversation(event.qualified_conversation, members);

    this.logger.info(`Processed MemberJoin event for conversationId: ${obfuscateId(event.qualified_conversation.id)}`);
  }
}
