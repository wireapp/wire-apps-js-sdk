import {sqliteTable, text, primaryKey, foreignKey, integer} from 'drizzle-orm/sqlite-core'
import {sql} from 'drizzle-orm'

export const appProperties = sqliteTable('app_properties', {
  key: text().primaryKey().notNull(),
  value: text().notNull(),
  creationDate: text('creation_date')
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
})

export const conversation = sqliteTable(
  'conversation',
  {
    id: text().notNull(),
    domain: text().notNull(),
    name: text(),
    teamId: text('team_id'),
    mlsGroupId: text('mls_group_id').notNull(),
    creationDate: text('creation_date')
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    type: integer().notNull()
  },
  (table) => [primaryKey({columns: [table.id, table.domain], name: 'conversation_id_domain_pk'})]
)

export const conversationMember = sqliteTable(
  'conversation_member',
  {
    userId: text('user_id').notNull(),
    userDomain: text('user_domain').notNull(),
    conversationId: text('conversation_id').notNull(),
    conversationDomain: text('conversation_domain').notNull(),
    role: text().notNull(),
    creationDate: text('creation_date')
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull()
  },
  (table) => [
    foreignKey({
      columns: [table.conversationId, table.conversationDomain],
      foreignColumns: [conversation.id, conversation.domain],
      name: 'conversation_member_conversation_id_conversation_domain_conversation_id_domain_fk'
    }),
    primaryKey({
      columns: [table.userId, table.userDomain, table.conversationId, table.conversationDomain],
      name: 'conversation_member_user_id_user_domain_conversation_id_conversation_domain_pk'
    })
  ]
)
