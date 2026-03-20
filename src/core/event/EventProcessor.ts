import type {EventContentDTO} from "../../model/EventContentDTO.js";

export interface EventProcessor<T extends EventContentDTO> {
  process(event: T): Promise<void>;
}
