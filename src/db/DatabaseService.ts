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

import Database, { type Database as DB } from "better-sqlite3";
import { inject, singleton } from "tsyringe";
import { WIRE_DATABASE_PATH } from "../utils/DependencyInjectionTokens.js";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";

@singleton()
export class DatabaseService {
  private logger = LoggerFactory.getLogger(this.constructor.name)
  public readonly db: DB;
  static readonly DEFAULT_DATABASE_PATH = "storage/apps.db";

  constructor(@inject(WIRE_DATABASE_PATH) path: string) {
    this.logger.info("DatabaseService being created")
    this.db = new Database(path)
    this.db.pragma("foreign_keys = ON")

    this.runMigrations()
  }

  private runMigrations() {
    // TODO: Handle migration version
    this.db.exec(`
      -- Conversation table
      CREATE TABLE IF NOT EXISTS conversation (
        id TEXT NOT NULL,
        domain TEXT NOT NULL,
        name TEXT,
        team_id TEXT,
        mls_group_id TEXT NOT NULL,
        creation_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        type TEXT NOT NULL,
        PRIMARY KEY (id, domain)
      );

      -- Conversation Members table
      CREATE TABLE IF NOT EXISTS conversation_member (
        user_id TEXT NOT NULL,
        user_domain TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        conversation_domain TEXT NOT NULL,
        role TEXT NOT NULL,
        creation_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, user_domain, conversation_id, conversation_domain),
        FOREIGN KEY(conversation_id, conversation_domain)
          REFERENCES conversation(id, domain)
      );

      -- App table
      CREATE TABLE IF NOT EXISTS app (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        creation_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
  }

  close() {
    this.db.close()
  }
}
