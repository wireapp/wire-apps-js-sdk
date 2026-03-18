import { sqliteTable, text, primaryKey, foreignKey } from "drizzle-orm/sqlite-core"

export const appProperties = sqliteTable("app_properties", {
  key: text().primaryKey().notNull(),
  value: text().notNull(),
  creationDate: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const conversation = sqliteTable("conversation", {
  id: text().notNull(),
  domain: text().notNull(),
  name: text(),
  teamId: text(),
  mlsGroupId: text().notNull(),
  creationDate: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
  type: text().notNull(),
},
(table) => [
  primaryKey({ columns: [table.id, table.domain], name: "conversation_id_domain_pk"})
]);

export const conversationMember = sqliteTable("conversation_member", {
  userId: text().notNull(),
  userDomain: text().notNull(),
  conversationId: text().notNull(),
  conversationDomain: text().notNull(),
  role: text().notNull(),
  creationDate: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
  foreignKey(() => ({
    columns: [table.conversationId, table.conversationDomain],
    foreignColumns: [conversation.id, conversation.domain],
    name: "conversation_member_conversationId_conversationDomain_conversation_id_domain_fk"
  })),
  primaryKey({ columns: [table.userId, table.userDomain, table.conversationId, table.conversationDomain], name: "conversation_member_userId_userDomain_conversationId_conversationDomain_pk"})
]);
