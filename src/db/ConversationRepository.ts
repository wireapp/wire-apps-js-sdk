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

import {DatabaseService} from "./DatabaseService.js";
import type {ConversationEntity} from "./model/ConversationEntity.js";
import type {QualifiedId} from "../model/QualifiedId.js";
import {singleton} from "tsyringe";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";

@singleton()
export class ConversationRepository {
  private logger = LoggerFactory.getLogger(this.constructor.name)

  private selectAllStmt
  private selectByIdAndDomainStmt
  private insertStmt
  private deleteStmt
  private deleteAllMembersInConversationStmt


  constructor(private readonly database: DatabaseService) {
    this.selectAllStmt =
    this.database.db.prepare<[], ConversationEntity>(`
      SELECT *
      FROM conversation
    `)

    this.selectByIdAndDomainStmt =
    this.database.db.prepare<[string, string], ConversationEntity>(`
      SELECT *
      FROM conversation
      WHERE id = ? AND domain = ?
    `)

    this.insertStmt =
    this.database.db.prepare<[string, string, string | null, string | null, string, string], void>(`
      INSERT INTO conversation(id, domain, name, team_id, mls_group_id, type)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id, domain)
      DO UPDATE SET
        name = excluded.name,
        team_id = excluded.team_id,
        mls_group_id = excluded.mls_group_id,
        type = excluded.type
    `)

    this.deleteStmt =
    this.database.db.prepare<[string, string], void>(`
      DELETE FROM conversation
      WHERE id = ? AND domain = ?
    `)

    this.deleteAllMembersInConversationStmt =
      this.database.db.prepare<[string, string], void>(`
        DELETE
        FROM conversation_member
        WHERE conversation_id = ?
          AND conversation_domain = ?
      `)
  }

  getAll(): ConversationEntity[] {
    return this.selectAllStmt.all();
  }

  // TODO: Baris: It will be better to be consistent and pass id and domain separately.
  //  So this class will not know about the QualifiedId structure.
  findByIdAndDomain(conversationQualifiedId: QualifiedId): ConversationEntity | null {
    return this.selectByIdAndDomainStmt.get(conversationQualifiedId.id, conversationQualifiedId.domain) ?? null;
  }

  save(conv: ConversationEntity): void {
    this.insertStmt.run(
      conv.id,
      conv.domain,
      conv.name,
      conv.team_id,
      conv.mls_group_id,
      conv.type
    );
  }

  delete(id: string, domain: string): void {
    this.deleteStmt.run(id, domain);
  }

  deleteAllMembersInConversation(conversationId: string, conversationDomain: string) {
    this.logger.debug(`All members in the conversation will be deleted from database. conversation_domain = ${conversationDomain} WHERE id = ${conversationId}`);
    this.deleteAllMembersInConversationStmt.run(conversationId, conversationDomain);
    this.logger.debug(`All members in the conversation are deleted from database. conversation_domain = ${conversationDomain} WHERE id = ${conversationId}`);
  }
}
