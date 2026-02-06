import {describe, expect, it} from 'vitest';
import {
  isDeleteConversationEvent,
  isMLSWelcomeEvent,
  isNewConversationEvent,
  isNewMLSMessageEvent,
  isTypingEvent,
  isMemberJoinEvent,
  isMemberLeaveEvent,
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

  it('isNewConversationEvent returns true for conversation.create and false otherwise', () => {
    const positive = {
      type: 'conversation.create',
      time: new Date(),
      data: {id: 'conv-1'} as any,
      qualified_conversation: {id: '1'},
      qualified_from: {id: '2'},
    } as any;
    const negative = {type: 'conversation.mls-message-add'} as any;
    const missing = {} as any;

    expect(isNewConversationEvent(positive)).toBe(true);
    expect(isNewConversationEvent(negative)).toBe(false);
    expect(isNewConversationEvent(missing)).toBe(false);
  });

  it('isDeleteConversationEvent returns true for conversation.delete and false otherwise', () => {
    const positive = {
      type: 'conversation.delete',
      time: new Date(),
      qualified_conversation: {id: '1'},
      qualified_from: {id: '2'},
    } as any;
    const negative = {type: 'conversation.mls-message-add'} as any;
    const missing = {} as any;

    expect(isDeleteConversationEvent(positive)).toBe(true);
    expect(isDeleteConversationEvent(negative)).toBe(false);
    expect(isDeleteConversationEvent(missing)).toBe(false);
  });

  it('isTypingEvent returns true for conversation.typing and false otherwise', () => {
    const positive = {type: 'conversation.typing', qualified_conversation: {id: '1'}} as any;
    const negative = {type: 'conversation.mls-message-add'} as any;
    const missing = {} as any;

    expect(isTypingEvent(positive)).toBe(true);
    expect(isTypingEvent(negative)).toBe(false);
    expect(isTypingEvent(missing)).toBe(false);
  });

  it('isMemberJoinEvent returns true for conversation.member-join and false otherwise', () => {
    const positive = {
      type: 'conversation.member-join',
      time: new Date(),
      data: {
        users: [
          {qualified_id: {id: 'user-1'}, conversation_role: 'member'}
        ]
      },
      qualified_conversation: {id: '1'},
      qualified_from: {id: '2'},
    } as any;
    const negative = {type: 'conversation.create'} as any;
    const missing = {} as any;

    expect(isMemberJoinEvent(positive)).toBe(true);
    expect(isMemberJoinEvent(negative)).toBe(false);
    expect(isMemberJoinEvent(missing)).toBe(false);
  });

  it('isMemberLeaveEvent returns true for conversation.member-leave and false otherwise', () => {
    const positive = {
      type: 'conversation.member-leave',
      time: new Date(),
      data: {
        qualified_user_ids: [
          {id: 'user-1'}
        ],
        reason: 'left'
      },
      qualified_conversation: {id: '1'},
      qualified_from: {id: '2'},
    } as any;
    const negative = {type: 'conversation.create'} as any;
    const missing = {} as any;

    expect(isMemberLeaveEvent(positive)).toBe(true);
    expect(isMemberLeaveEvent(negative)).toBe(false);
    expect(isMemberLeaveEvent(missing)).toBe(false);
  });
});
