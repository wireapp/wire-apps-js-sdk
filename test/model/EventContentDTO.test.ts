// File: `test/model/EventContentDTO.test.ts`
import {describe, it, expect} from 'vitest';
import {
  isNewMLSMessageEvent,
  isMLSWelcomeEvent,
  isTypingEvent,
} from '../../src/model/EventContentDTO.js';

describe('EventContentDTO type guards', () => {
  it('isNewMLSMessageEvent returns true for conversation.mls-message-add and false otherwise', () => {
    const positive = {
      type: 'conversation.mls-message-add',
      data: 'x',
      qualified_conversation: {id: '1'},
      qualified_from: {id: '2'},
      time: new Date()
    } as any;
    const negative = {type: 'conversation.mls-welcome'} as any;
    const missing = {} as any;

    expect(isNewMLSMessageEvent(positive)).toBe(true);
    expect(isNewMLSMessageEvent(negative)).toBe(false);
    expect(isNewMLSMessageEvent(missing)).toBe(false);
  });

  it('isMLSWelcomeEvent returns true for conversation.mls-welcome and false otherwise', () => {
    const positive = {
      type: 'conversation.mls-welcome',
      data: 'y',
      qualified_conversation: {id: '1'},
      qualified_from: {id: '2'},
      time: new Date()
    } as any;
    const negative = {type: 'conversation.typing'} as any;
    const missing = {type: undefined} as any;

    expect(isMLSWelcomeEvent(positive)).toBe(true);
    expect(isMLSWelcomeEvent(negative)).toBe(false);
    expect(isMLSWelcomeEvent(missing)).toBe(false);
  });

  it('isTypingEvent returns true for conversation.typing and false otherwise', () => {
    const positive = {type: 'conversation.typing', qualified_conversation: {id: '1'}} as any;
    const negative = {type: 'conversation.mls-message-add'} as any;
    const missing = {} as any;

    expect(isTypingEvent(positive)).toBe(true);
    expect(isTypingEvent(negative)).toBe(false);
    expect(isTypingEvent(missing)).toBe(false);
  });
});
