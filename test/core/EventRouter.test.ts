// File: `test/core/EventRouter.test.ts`
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventRouter } from '../../src/core/EventRouter.js';

describe('EventRouter.processNewConversationEvent', () => {
  let mockConversationService: any;
  let router: EventRouter;

  beforeEach(() => {
    mockConversationService = {
      saveConversationWithMembers: vi.fn().mockResolvedValue({}),
    };

    const mockCoreCryptoService = {} as any;
    const mockMlsService = {} as any;
    const mockWireEventsHandler = {} as any;

    router = new EventRouter(
      mockCoreCryptoService,
      mockConversationService,
      mockMlsService,
      mockWireEventsHandler
    );
  });

  it('forwards qualified_conversation and data to conversationService.saveConversationWithMembers', async () => {
    const event = {
      qualified_conversation: { id: 'conv-id' },
      data: { name: 'test' },
    };

    await (router as any).processNewConversationEvent(event as any);

    expect(mockConversationService.saveConversationWithMembers).toHaveBeenCalledTimes(1);
    expect(mockConversationService.saveConversationWithMembers).toHaveBeenCalledWith(
      event.qualified_conversation,
      event.data
    );
  });
});
