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

import { Service } from "typedi";
import { DatabaseService } from "./DatabaseService.js";
import type { ConversationEntity } from "./model/ConversationEntity.js";
import type {QualifiedId} from "../model/QualifiedId.js";

@Service()
export class ConversationRepository {
  private selectAllStmt
  private selectByIdAndDomainStmt
  private insertStmt
  private deleteStmt

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
  }

  getAll(): ConversationEntity[] {
    return this.selectAllStmt.all();
  }

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
}
