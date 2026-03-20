/*
* Wire
* Copyright (C) 2026 Wire Swiss GmbH
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

import type {UserEntity} from "./model/UserEntity.js";
import {DatabaseService} from "./DatabaseService.js";
import {singleton} from "tsyringe";

// User profiles are stored in a dedicated table rather than embedded in conversation_member
// to avoid duplicating name/handle across every conversation a user belongs to.
// A single update here reflects everywhere without touching member rows.
@singleton()
export class UserRepository {
  private selectByIdAndDomainStmt
  private insertStmt

  constructor(private readonly database: DatabaseService) {
    this.selectByIdAndDomainStmt =
      this.database.db.prepare<[string, string], UserEntity>(`
        SELECT *
        FROM user
        WHERE user_id = ? AND user_domain = ?
      `)

    this.insertStmt =
      this.database.db.prepare<[string, string, string, string | null], void>(`
        INSERT INTO user(user_id, user_domain, name, handle)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, user_domain)
        DO UPDATE SET
          name = excluded.name,
          handle = excluded.handle
      `)
  }

  findByIdAndDomain(id: string, domain: string): UserEntity | null {
    return this.selectByIdAndDomainStmt.get(id, domain) ?? null
  }

  save(user: UserEntity): void {
    this.insertStmt.run(user.user_id, user.user_domain, user.name, user.handle)
  }

  saveMany(users: UserEntity[]): void {
    const insertMany = this.database.db.transaction((users: UserEntity[]) => {
      for (const user of users) {
        this.save(user)
      }
    })
    insertMany(users)
  }
}
