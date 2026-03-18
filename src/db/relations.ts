import { relations } from "drizzle-orm/relations";
import { conversation, conversationMember } from "./schema";

export const conversationMemberRelations = relations(conversationMember, ({one}) => ({
  conversation: one(conversation, {
    fields: [conversationMember.conversationId],
    references: [conversation.id]
  }),
}));

export const conversationRelations = relations(conversation, ({many}) => ({
  conversationMembers: many(conversationMember),
}));
