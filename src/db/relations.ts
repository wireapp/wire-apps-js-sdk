import { relations } from "drizzle-orm/relations";
import { conversation, conversationMember } from "./schema.js";

export const conversationMemberRelations = relations(conversationMember, ({one}) => ({
  conversation: one(conversation, {
    fields: [conversationMember.conversationId, conversationMember.conversationDomain],
    references: [conversation.id, conversation.domain]
  }),
}));

export const conversationRelations = relations(conversation, ({many}) => ({
  conversationMembers: many(conversationMember),
}));
