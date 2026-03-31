import type {EventContentDTO} from "../../model/EventContentDTO.js";

export interface EventProcessor<T extends EventContentDTO> {
  readonly eventType: T["type"];
  process(event: T): Promise<void>;
}
