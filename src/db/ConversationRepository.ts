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
import {singleton} from "tsyringe";
import {conversation} from "./schema.js";
import {and, eq, sql} from "drizzle-orm";
import {ConversationType} from "../model/conversation/ConversationType.js";

@singleton()
export class ConversationRepository {

  private selectAllStmt
  private selectByIdAndDomainStmt
  private selectOneToOneByName
  private insertStmt
  private deleteStmt

  constructor(private readonly databaseService: DatabaseService) {
    this.selectAllStmt = this.databaseService.db.select().from(conversation).prepare();

    this.selectByIdAndDomainStmt =
      this.databaseService.db.select().from(conversation).where(
        and(
          eq(conversation.id, sql.placeholder('id')),
          eq(conversation.domain, sql.placeholder('domain')
          )
        )
      ).prepare();

    this.selectOneToOneByName =
      this.databaseService.db.select().from(conversation).where(
        and(
          eq(conversation.name, sql.placeholder('name')),
          eq(conversation.domain, sql.placeholder('domain')),
          eq(conversation.type, ConversationType.ONE_TO_ONE)
        )
      ).prepare();

    this.insertStmt =
      this.databaseService.db.insert(conversation).values(
        {
          id: sql.placeholder('id'),
          domain: sql.placeholder('domain'),
          name: sql.placeholder('name'),
          teamId: sql.placeholder('teamId'),
          mlsGroupId: sql.placeholder('mlsGroupId'),
          type: sql.placeholder('type')
        }
      ).onConflictDoUpdate(
        {
          target: [conversation.id, conversation.domain],
          set: {
            name: sql.raw(`excluded.${conversation.name.name}`),
            teamId: sql.raw(`excluded.${conversation.teamId.name}`),
            mlsGroupId: sql.raw(`excluded.${conversation.mlsGroupId.name}`),
            type: sql.raw(`excluded.${conversation.type.name}`),
          }
        }
      ).prepare();

    this.deleteStmt = this.databaseService.db.delete(conversation).where(
      and(
        eq(conversation.id, sql.placeholder('id')),
        eq(conversation.domain, sql.placeholder('domain'))
      )
    ).prepare();
  }

  getAll(): ConversationEntity[] {
    return this.selectAllStmt.all();
  }

  findByIdAndDomain(id: string, domain: string): ConversationEntity | null {
    return this.selectByIdAndDomainStmt.get({
      id: id,
      domain: domain
    }) ?? null;
  }

  findOneToOneByNameAndDomain(name: string, domain: string): ConversationEntity | null {
    return this.selectOneToOneByName.get({
      name: name,
      domain: domain
    }) ?? null;
  }

  save(conv: ConversationEntity): void {
    this.insertStmt.run({
      id: conv.id,
      domain: conv.domain,
      name: conv.name,
      teamId: conv.teamId,
      mlsGroupId: conv.mlsGroupId,
      type: conv.type
    });
  }

  delete(id: string, domain: string): void {
    this.deleteStmt.run({
      id: id,
      domain: domain
    });
  }
}
