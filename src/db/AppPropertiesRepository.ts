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

import {singleton} from 'tsyringe'
import {DatabaseService} from './DatabaseService.js'
import type {AppEntity} from './model/AppEntity.js'
import {appProperties} from './schema.js'
import {eq, sql} from 'drizzle-orm'

@singleton()
export class AppPropertiesRepository {
  private selectByKeyStmt
  private insertStmt
  private deleteStmt

  constructor(private readonly databaseService: DatabaseService) {
    this.selectByKeyStmt = this.databaseService.db
      .select()
      .from(appProperties)
      .where(eq(appProperties.key, sql.placeholder('key')))
      .prepare()

    this.insertStmt = this.databaseService.db
      .insert(appProperties)
      .values({
        key: sql.placeholder('key'),
        value: sql.placeholder('value')
      })
      .onConflictDoUpdate({
        target: appProperties.key,
        set: {value: sql.raw(`excluded.${appProperties.value.name}`)}
      })
      .prepare()

    this.deleteStmt = this.databaseService.db
      .delete(appProperties)
      .where(eq(appProperties.key, sql.placeholder('key')))
      .prepare()
  }

  getByKey(key: string): AppEntity | undefined {
    return this.selectByKeyStmt.get({key})
  }

  /**
   * Save (UPSERT) a key-value pair representing a property.
   */
  save(key: string, value: string): void {
    this.insertStmt.run({key, value})
  }

  delete(key: string) {
    this.deleteStmt.run({key})
  }
}
