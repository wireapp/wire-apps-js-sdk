import {inject, singleton} from "tsyringe";
import {ProtobufDeserializer} from "../../mappers/protobuf/ProtobufDeserializer.js";
import type {EventProcessor} from "./EventProcessor.js";
import type {NewMLSMessageDTO} from "../../model/EventContentDTO.js";
import {CoreCryptoService} from "../CoreCryptoService.js";
import {ConversationService} from "../../api/ConversationService.js";
import {WireEventsHandler} from "../WireEventsHandler.js";
import {WIRE_EVENTS_HANDLER} from "../../utils/DependencyInjectionTokens.js";
import {isCoreCryptoMlsException} from "../../model/exception/CoreCryptoMlsException.js";
import {isMlsException} from "../../model/exception/MlsException.js";
import {LoggerFactory} from "../../utils/logger/LoggerFactory.js";
import {MlsFallbackStrategy} from "../../service/MlsFallbackStrategy.js";

@singleton()
export class MlsMessageEventProcessor implements EventProcessor<NewMLSMessageDTO> {
  private logger = LoggerFactory.getLogger(this.constructor.name);

  readonly eventType = "conversation.mls-message-add" as const;

  constructor(
    private coreCryptoService: CoreCryptoService,
    private conversationService: ConversationService,
    private mlsFallbackStrategy: MlsFallbackStrategy,
    @inject(WIRE_EVENTS_HANDLER) private wireEventsHandler: WireEventsHandler
  ) {
  }

  async process(event: NewMLSMessageDTO): Promise<void> {
    const mlsGroupId = await this.conversationService.getConversationMLSGroupId(event.qualified_conversation);

    try {
      const message = await this.coreCryptoService.decryptMls(mlsGroupId, event.data);

      if (message == null) {
        this.logger.debug("Decryption success but no message, probably epoch update");
        return;
      }

      await this.forwardMessage(message, event);
    } catch (exception) {
      if (isMlsException(exception)) {
        this.logger.debug("Message decryption failed, MlsException:", exception);
        await this.mlsFallbackStrategy.verifyConversationOutOfSync(mlsGroupId, event.qualified_conversation);
      } else if (isCoreCryptoMlsException(exception)) {
        this.logger.debug("Message decryption failed, CoreCryptoException.Mls:", exception);
        await this.mlsFallbackStrategy.verifyConversationOutOfSync(mlsGroupId, event.qualified_conversation);
      } else {
        throw exception;
      }
    }
  }

  private async forwardMessage(message: Uint8Array, event: NewMLSMessageDTO): Promise<void> {
    const wireMessage = ProtobufDeserializer.toWireMessage(message, event.qualified_conversation);

    switch (wireMessage.type) {
      case 'text':
        await this.wireEventsHandler.onTextMessageReceived(wireMessage);
        break;
      case 'asset':
        await this.wireEventsHandler.onAssetMessageReceived(wireMessage);
        break;
      case 'unknown':
      default:
        this.logger.info("Unknown event received.");
    }
  }
}
