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

import { DatabaseService } from '../../src/db/DatabaseService.js'

export class TestDatabaseService extends DatabaseService {
  constructor() {
    super(':memory:')
    this.setupTestSchema()
  }

  private setupTestSchema() {
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
    `)
  }

  clearData() {
    this.db.exec('DELETE FROM conversation_member')
    this.db.exec('DELETE FROM conversation')
  }
}
