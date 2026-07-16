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
import {singleton} from "tsyringe";
import {LoggerFactory} from "../utils/logger/LoggerFactory.js";
import {BetterSQLite3Database, drizzle} from 'drizzle-orm/better-sqlite3';
import {migrate} from "drizzle-orm/better-sqlite3/migrator";
import {DATABASE_PATH} from "../utils/StoragePaths.js";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

@singleton()
export class DatabaseService {
  private logger = LoggerFactory.getLogger(this.constructor.name)
  private readonly sqliteClient: DB;
  public readonly db: BetterSQLite3Database;

  constructor() {
    this.logger.info("DatabaseService being created")
    this.sqliteClient = new Database(this.getDatabasePath())
    this.sqliteClient.pragma("foreign_keys = ON")

    this.db = drizzle({ client: this.sqliteClient });
    this.migrate()
  }

  protected getDatabasePath(): string {
    return DATABASE_PATH
  }

  protected getMigrationsFolder(): string {
    return join(dirname(fileURLToPath(import.meta.url)), "migrations")
  }

  private migrate() {
    const migrationsFolder = this.getMigrationsFolder()
    this.logger.info("Running database migrations")
    try {
      migrate(this.db, {
        migrationsFolder
      })
    } catch (exception) {
      throw new Error(
        `Failed to run Wire Apps SDK database migrations from "${migrationsFolder}". ` +
          `Make sure the database migration files are included next to the built ` +
          `DatabaseService.js file, for example in "build/db/migrations".`,
        { cause: exception }
      ) 
    }
  }

  close() {
    this.sqliteClient.close()
  }
}
