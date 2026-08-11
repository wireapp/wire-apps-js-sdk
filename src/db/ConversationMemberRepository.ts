/*
 * Wire
 * Copyright (C) 2025 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 */

import type {ConversationMemberEntity} from './model/ConversationMemberEntity.js'
import {DatabaseService} from './DatabaseService.js'
import {singleton} from 'tsyringe'
import {LoggerFactory} from '../utils/logger/LoggerFactory.js'
import {obfuscateId} from '../utils/ObfuscateUtil.js'
import type {QualifiedId} from '../model/QualifiedId.js'
import {conversationMember} from './schema.js'
import {and, eq, sql} from 'drizzle-orm'

@singleton()
export class ConversationMemberRepository {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  private selectAllStmt
  private selectByIdAndDomainStmt
  private insertStmt
  private deleteStmt
  private deleteAllMembersInConversationStmt
  private existsStmt

  constructor(private readonly databaseService: DatabaseService) {
    this.selectAllStmt = this.databaseService.db.select().from(conversationMember).prepare()

    this.selectByIdAndDomainStmt = this.databaseService.db
      .select()
      .from(conversationMember)
      .where(
        and(
          eq(conversationMember.conversationId, sql.placeholder('conversationId')),
          eq(conversationMember.conversationDomain, sql.placeholder('conversationDomain'))
        )
      )
      .prepare()

    this.insertStmt = this.databaseService.db
      .insert(conversationMember)
      .values({
        userId: sql.placeholder('userId'),
        userDomain: sql.placeholder('userDomain'),
        conversationId: sql.placeholder('conversationId'),
        conversationDomain: sql.placeholder('conversationDomain'),
        role: sql.placeholder('role')
      })
      .onConflictDoUpdate({
        target: [
          conversationMember.userId,
          conversationMember.userDomain,
          conversationMember.conversationId,
          conversationMember.conversationDomain
        ],
        set: {role: sql.raw(`excluded.${conversationMember.role.name}`)}
      })
      .prepare()

    this.deleteStmt = this.databaseService.db
      .delete(conversationMember)
      .where(
        and(
          eq(conversationMember.userId, sql.placeholder('userId')),
          eq(conversationMember.userDomain, sql.placeholder('userDomain')),
          eq(conversationMember.conversationId, sql.placeholder('conversationId')),
          eq(conversationMember.conversationDomain, sql.placeholder('conversationDomain'))
        )
      )
      .prepare()

    this.deleteAllMembersInConversationStmt = this.databaseService.db
      .delete(conversationMember)
      .where(
        and(
          eq(conversationMember.conversationId, sql.placeholder('conversationId')),
          eq(conversationMember.conversationDomain, sql.placeholder('conversationDomain'))
        )
      )
      .prepare()

    this.existsStmt = this.databaseService.db
      .select({found: sql<number>`1`})
      .from(conversationMember)
      .where(
        and(
          eq(conversationMember.userId, sql.placeholder('userId')),
          eq(conversationMember.userDomain, sql.placeholder('userDomain')),
          eq(conversationMember.conversationId, sql.placeholder('conversationId')),
          eq(conversationMember.conversationDomain, sql.placeholder('conversationDomain'))
        )
      )
      .limit(1)
      .prepare()
  }

  getAll(): ConversationMemberEntity[] {
    return this.selectAllStmt.all()
  }

  getMembersByConversationId(id: string, domain: string): ConversationMemberEntity[] {
    return this.selectByIdAndDomainStmt.all({conversationId: id, conversationDomain: domain})
  }

  save(member: ConversationMemberEntity): void {
    this.insertStmt.run({
      userId: member.userId,
      userDomain: member.userDomain,
      conversationId: member.conversationId,
      conversationDomain: member.conversationDomain,
      role: member.role
    })
  }

  saveMany(members: ConversationMemberEntity[]) {
    this.databaseService.db.transaction(() => {
      for (const member of members) {
        this.save(member)
      }
    })
  }

  delete(userId: string, userDomain: string, conversationId: string, conversationDomain: string): void {
    this.deleteStmt.run({
      userId,
      userDomain,
      conversationId,
      conversationDomain
    })
  }

  deleteMany(userIds: QualifiedId[], conversationId: string, conversationDomain: string) {
    this.databaseService.db.transaction(() => {
      for (const userId of userIds) {
        this.delete(userId.id, userId.domain, conversationId, conversationDomain)
      }
    })
  }

  deleteAllMembersInConversation(conversationId: string, conversationDomain: string) {
    this.logger.debug(
      `All members in the conversation will be deleted from database. conversationId: ${obfuscateId(conversationId)}, conversationDomain: ${conversationDomain}`
    )
    this.deleteAllMembersInConversationStmt.run({conversationId, conversationDomain})
    this.logger.debug(
      `All members in the conversation are deleted from database. conversationId: ${obfuscateId(conversationId)}, conversationDomain: ${conversationDomain}`
    )
  }

  exists(userId: string, userDomain: string, conversationId: string, conversationDomain: string): boolean {
    const result = this.existsStmt.get({
      userId: userId,
      userDomain: userDomain,
      conversationId: conversationId,
      conversationDomain: conversationDomain
    })

    return result !== undefined
  }
}
