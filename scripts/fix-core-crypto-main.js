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

import { readFileSync, writeFileSync, existsSync } from 'fs';

const filePath = 'node_modules/@wireapp/core-crypto/package.json';

if (!existsSync(filePath)) {
  console.log('⚠️  Core-Crypto package.json not found, skipping main fix');
  // eslint-disable-next-line no-undef
  process.exit(0);
}

let content = readFileSync(filePath, 'utf8');

// Fix CoreCrypto main usged file
content = content.replace(
  '"main": "src/CoreCrypto.ts"',
  '"main": "src/CoreCrypto.js"'
);

writeFileSync(filePath, content, 'utf8');
console.log('✓ Fixed CoreCrypto main in package.json');
