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

import {cpSync} from "node:fs";

const source = "./src/db/migrations";
const destination = "./build/db/migrations";

// DatabaseService looks for migrations next to the built DatabaseService.js.
cpSync(source, destination, {recursive: true});

console.log(`✓ Copied database migrations to ${destination}`);
