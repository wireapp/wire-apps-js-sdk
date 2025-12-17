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

import type { ConversationMemberEntity } from "./model/ConversationMemberEntity.js";
import { DatabaseService } from "./DatabaseService.js";
import { singleton } from "tsyringe";

@singleton()
export class ConversationMemberRepository {
  private selectAllStmt
  private selectByIdAndDomainStmt
  private insertStmt
  private deleteStmt

  constructor(private readonly database: DatabaseService) {
    this.selectAllStmt =
    this.database.db.prepare<[], ConversationMemberEntity>(`
      SELECT *
      FROM conversation_member
    `)

    this.selectByIdAndDomainStmt =
    this.database.db.prepare<[string, string], ConversationMemberEntity>(`
      SELECT *
      FROM conversation_member
      WHERE conversation_id = ? AND conversation_domain = ?
    `)

    this.insertStmt =
    this.database.db.prepare<[string, string, string, string, string], void>(`
      INSERT INTO conversation_member(
        user_id, user_domain, 
        conversation_id, conversation_domain, 
        role
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, user_domain, conversation_id, conversation_domain)
      DO UPDATE SET role = excluded.role
    `)

    this.deleteStmt =
    this.database.db.prepare<[string, string, string, string], void>(`
      DELETE FROM conversation_member
      WHERE user_id = ? 
        AND user_domain = ? 
        AND conversation_id = ? 
        AND conversation_domain = ?
    `)
  }

  getAll(): ConversationMemberEntity[] {
    return this.selectAllStmt.all()
  }

  getMembersByConversationId(id: string, domain: string): ConversationMemberEntity[] {
    return this.selectByIdAndDomainStmt.all(id, domain)
  }

  save(member: ConversationMemberEntity): void {
    this.insertStmt.run(
      member.user_id,
      member.user_domain,
      member.conversation_id,
      member.conversation_domain,
      member.role
    )
  }

  saveMany(members: ConversationMemberEntity[]) {
    const insertMany = this.database.db.transaction((members) => {
      for (const member of members) {
        this.save(member)
      }
    })
    insertMany(members)
  }

  delete(
    userId: string,
    userDomain: string,
    conversationId: string,
    conversationDomain: string
  ): void {
    this.deleteStmt.run(
      userId,
      userDomain,
      conversationId,
      conversationDomain
    )
  }
}
